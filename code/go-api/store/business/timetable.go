package business

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/charmbracelet/log"
	"github.com/couchbase/gocb/v2"
)

const (
	DefaultTimetableKey = "default-timetable"
)

type BusinessStore struct {
	bucket      *gocb.Bucket
	scope       *gocb.Scope
	configCol   *gocb.Collection
	scheduleCol *gocb.Collection

	logger *log.Logger
}

func NewBusinessStore(bucket *gocb.Bucket, logger *log.Logger) BusinessStore {
	err := bucket.CollectionsV2().CreateScope("business", &gocb.CreateScopeOptions{})
	if err != nil && !errors.Is(err, gocb.ErrScopeExists) {
		logger.Fatal("failed to create scope", "err", err)
	}

	scope := bucket.Scope("business")

	err = bucket.CollectionsV2().CreateCollection(scope.Name(), "configs", &gocb.CreateCollectionSettings{}, &gocb.CreateCollectionOptions{})
	if err != nil && !errors.Is(err, gocb.ErrCollectionExists) {
		logger.Fatal("failed to create collection", "err", err)
	}

	err = bucket.CollectionsV2().CreateCollection(scope.Name(), "schedule", &gocb.CreateCollectionSettings{}, &gocb.CreateCollectionOptions{})
	if err != nil && !errors.Is(err, gocb.ErrCollectionExists) {
		logger.Fatal("failed to create collection", "err", err)
	}

	return BusinessStore{
		bucket:      bucket,
		scope:       scope,
		configCol:   scope.Collection("configs"),
		scheduleCol: scope.Collection("schedule"),
		logger:      logger,
	}
}

func (bs *BusinessStore) SetConfig(ctx context.Context, key string, value interface{}) error {
	_, err := bs.configCol.Upsert(key, value, &gocb.UpsertOptions{
		Context: ctx,
	})
	return err
}

var (
	ErrConfigNotFound = gocb.ErrDocumentNotFound
)

type ShiftTimetable struct {
	From              time.Time `json:"from"`
	To                time.Time `json:"to"`
	RequiredEmployees int       `json:"requiredEmployees"`
}
type DayTimetable struct {
	Shifts []ShiftTimetable `json:"shifts"`
}
type WeekTimetable struct {
	Monday    DayTimetable `json:"monday"`
	Tuesday   DayTimetable `json:"tuesday"`
	Wednesday DayTimetable `json:"wednesday"`
	Thursday  DayTimetable `json:"thursday"`
	Friday    DayTimetable `json:"friday"`
	Saturday  DayTimetable `json:"saturday"`
	Sunday    DayTimetable `json:"sunday"`
}

func (bs *BusinessStore) SetDefaultTimetable(ctx context.Context, tt WeekTimetable) error {
	_, err := bs.configCol.Upsert(DefaultTimetableKey, tt, &gocb.UpsertOptions{
		Context: ctx,
	})
	return err
}

func (bs *BusinessStore) GetDefaultTimetable(ctx context.Context) (WeekTimetable, error) {
	res, err := bs.configCol.Get(DefaultTimetableKey, &gocb.GetOptions{
		Context: ctx,
	})
	if errors.Is(err, gocb.ErrDocumentNotFound) {
		return WeekTimetable{}, ErrConfigNotFound
	}
	if err != nil {
		return WeekTimetable{}, err
	}

	var tt WeekTimetable
	err = res.Content(&tt)
	return tt, err
}

type DetailedWeekTimetable struct {
	WeekStr string `json:"weekStr"`
	WeekTimetable
}

type WeeksTimetable struct {
	FirstWeekDate string                           `json:"firstWeekDate"`
	Weeks         map[string]DetailedWeekTimetable `json:"weeks"`
}

func (bs *BusinessStore) GetTimetable(ctx context.Context, from time.Time, to time.Time) (WeeksTimetable, error) {
	defaultTt, err := bs.GetDefaultTimetable(ctx)
	if err != nil {
		return WeeksTimetable{}, err
	}

	startYear, startWeek := from.ISOWeek()
	endYear, endWeek := to.ISOWeek()

	if startYear == endYear {
		weeks := make(map[string]DetailedWeekTimetable, endWeek-startWeek+1)
		for i := startWeek; i <= endWeek; i++ {
			week := from.AddDate(0, 0, 7*(i-startWeek))
			weekDateStr := week.Format("2006-01-02")
			_, weekNr := week.ISOWeek()
			humanReadWeekStr := fmt.Sprintf("Week %d", weekNr)
			weeks[weekDateStr] = DetailedWeekTimetable{
				WeekStr:       humanReadWeekStr,
				WeekTimetable: defaultTt,
			}
		}

		return WeeksTimetable{
			FirstWeekDate: from.Format("2006-01-02"),
			Weeks:         weeks,
		}, nil
	}

	weeks := make(map[string]DetailedWeekTimetable, endWeek-startWeek+1)
	yearDiff := endYear - startYear
	absEndWeek := endWeek + yearDiff*52
	for i := startWeek; i <= absEndWeek; i++ {
		adjustedWeekNr := i % 52
		addYears := i / 52
		week := from.AddDate(addYears, 0, 7*(adjustedWeekNr-startWeek))
		weekDateStr := week.Format("2006-01-02")
		_, weekNr := week.ISOWeek()
		humanReadWeekStr := fmt.Sprintf("Week %d", weekNr)
		weeks[weekDateStr] = DetailedWeekTimetable{
			WeekStr:       humanReadWeekStr,
			WeekTimetable: defaultTt,
		}
	}

	return WeeksTimetable{
		FirstWeekDate: from.Format("2006-01-02"),
		Weeks:         weeks,
	}, nil
}

type DaysTimetable struct {
	Days map[string]DayTimetable `json:"days"`
}

func (bs *BusinessStore) Meep(ctx context.Context, from time.Time, to time.Time) (DaysTimetable, error) {
	defaultTt, err := bs.GetDefaultTimetable(ctx)
	if err != nil {
		return DaysTimetable{}, err
	}

	numDays := int(to.Sub(from).Hours() / 24)
	bs.logger.Print("numDays", numDays)

	days := make(map[string]DayTimetable, numDays)
	for i := 0; i < numDays; i++ {
		day := from.Add(time.Duration(i) * 24 * time.Hour)
		dayStr := day.Format(time.DateOnly)
		weekday := day.Weekday().String()

		dtt, err := getDefaultDayTimetable(defaultTt, weekday)
		if err != nil {
			return DaysTimetable{}, err
		}

		days[dayStr] = dtt
	}

	return DaysTimetable{
		Days: days,
	}, nil
}

func getDefaultDayTimetable(tt WeekTimetable, weekday string) (DayTimetable, error) {
	switch weekday {
	case "Monday":
		return tt.Monday, nil
	case "Tuesday":
		return tt.Tuesday, nil
	case "Wednesday":
		return tt.Wednesday, nil
	case "Thursday":
		return tt.Thursday, nil
	case "Friday":
		return tt.Friday, nil
	case "Saturday":
		return tt.Saturday, nil
	case "Sunday":
		return tt.Sunday, nil
	default:
		return DayTimetable{}, errors.New("unknown weekday")
	}
}

type ShiftSchedule struct {
	From      time.Time `json:"from"`
	To        time.Time `json:"to"`
	Employees []string  `json:"employees"`
}

type DaySchedule struct {
	Shifts []ShiftSchedule `json:"shifts"`
}

type WeekSchedule struct {
	Monday    DaySchedule `json:"monday"`
	Tuesday   DaySchedule `json:"tuesday"`
	Wednesday DaySchedule `json:"wednesday"`
	Thursday  DaySchedule `json:"thursday"`
	Friday    DaySchedule `json:"friday"`
	Saturday  DaySchedule `json:"saturday"`
	Sunday    DaySchedule `json:"sunday"`
}

func (bs *BusinessStore) CreateScheduleForWeek(ctx context.Context, week time.Time, ws WeekSchedule) error {
	weekStr := week.Format("2006-01-02")
	_, err := bs.scheduleCol.Upsert(weekStr, ws, &gocb.UpsertOptions{
		Context: ctx,
	})
	return err
}

func (bs *BusinessStore) GetScheduleForWeek(ctx context.Context, week time.Time) (WeekSchedule, error) {
	weekStr := week.Format("2006-01-02")
	res, err := bs.scheduleCol.Get(weekStr, &gocb.GetOptions{
		Context: ctx,
	})
	if errors.Is(err, gocb.ErrDocumentNotFound) {
		return WeekSchedule{}, ErrConfigNotFound
	}
	if err != nil {
		return WeekSchedule{}, err
	}

	var ws WeekSchedule
	err = res.Content(&ws)
	return ws, err
}
