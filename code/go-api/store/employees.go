package store

import (
	"context"
	"errors"
	"fmt"
	"math/rand"
	"time"

	"github.com/charmbracelet/log"
	"github.com/couchbase/gocb/v2"
)

var (
	ErrEmployeeAlreadyExists = gocb.ErrDocumentExists
)

type EmployeeStore struct {
	bucket *gocb.Bucket
	scope  *gocb.Scope
	col    *gocb.Collection
	avaCol *gocb.Collection
	logger *log.Logger
}

func NewEmployeeStore(bucket *gocb.Bucket, logger *log.Logger) EmployeeStore {
	err := bucket.CollectionsV2().CreateScope("employees", &gocb.CreateScopeOptions{})
	if err != nil && !errors.Is(err, gocb.ErrScopeExists) {
		logger.Fatal("failed to create scope", "err", err)
	}
	scope := bucket.Scope("employees")

	err = bucket.CollectionsV2().CreateCollection(scope.Name(), "employees", &gocb.CreateCollectionSettings{}, &gocb.CreateCollectionOptions{})
	if err != nil && !errors.Is(err, gocb.ErrCollectionExists) {
		logger.Fatal("failed to create collection", "err", err)
	}
	col := scope.Collection("employees")

	err = bucket.CollectionsV2().CreateCollection(scope.Name(), "availability", &gocb.CreateCollectionSettings{}, &gocb.CreateCollectionOptions{})
	if err != nil && !errors.Is(err, gocb.ErrCollectionExists) {
		logger.Fatal("failed to create collection", "err", err)
	}
	avaCol := scope.Collection("availability")

	return EmployeeStore{
		bucket: bucket,
		scope:  scope,
		col:    col,
		logger: logger,
		avaCol: avaCol,
	}
}

type Employee struct {
	Name             string `json:"name"`
	Email            string `json:"email"`
	Address          string `json:"address"`
	DateOfBirth      int64  `json:"date_of_birth"`
	EmergencyContact int64  `json:"emergency_contact"`
}

func (es *EmployeeStore) Create(ctx context.Context, e Employee) error {
	_, err := es.col.Upsert(e.Email, e, &gocb.UpsertOptions{
		Context: ctx,
	})
	if err != nil {
		return err
	}

	ava := generateDefaultAvailability()
	es.logger.Print(ava)
	_, err = es.avaCol.Upsert(e.Email, ava, &gocb.UpsertOptions{
		Context: ctx,
	})

	return err
}

func (es *EmployeeStore) Get(ctx context.Context, email string) (Employee, error) {
	res, err := es.col.Get(email, &gocb.GetOptions{
		Context: ctx,
	})
	if err != nil {
		return Employee{}, err
	}

	var e Employee
	err = res.Content(&e)
	return e, err
}

func (es *EmployeeStore) Delete(ctx context.Context, email string) error {
	_, err := es.col.Remove(email, &gocb.RemoveOptions{
		Context: ctx,
	})
	if err == gocb.ErrDocumentNotFound {
		return nil
	}
	return err
}

func (es *EmployeeStore) All(ctx context.Context) ([]Employee, error) {
	res, err := es.scope.Query("SELECT x.* FROM employees x", &gocb.QueryOptions{
		Context: ctx,
	})
	if err != nil {
		return nil, err
	}

	var employees []Employee
	for res.Next() {
		var e Employee
		err := res.Row(&e)
		if err != nil {
			return nil, err
		}
		employees = append(employees, e)

		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		default:
		}
	}

	return employees, nil
}

func (es *EmployeeStore) Availability(ctx context.Context, email string) (EmployeeAvailability, error) {
	res, err := es.avaCol.Get(email, &gocb.GetOptions{
		Context: ctx,
	})
	if err != nil {
		return EmployeeAvailability{}, err
	}

	var ava EmployeeAvailability
	err = res.Content(&ava)
	return ava, err
}

type DayAvilability struct {
	Date         time.Time  `json:"date"`
	Availability string     `json:"availability"` // "available", "unavailable", "partial"
	From         *time.Time `json:"from,omitempty"`
	To           *time.Time `json:"to,omitempty"`
}

type WeekAvailability struct {
	WeekStr   string         `json:"weekStr"`
	Monday    DayAvilability `json:"monday"`
	Tuesday   DayAvilability `json:"tuesday"`
	Wednesday DayAvilability `json:"wednesday"`
	Thursday  DayAvilability `json:"thursday"`
	Friday    DayAvilability `json:"friday"`
	Saturday  DayAvilability `json:"saturday"`
	Sunday    DayAvilability `json:"sunday"`
}

type EmployeeAvailability struct {
	Weeks map[string]WeekAvailability `json:"weeks"`
}

func generateDefaultAvailability() EmployeeAvailability {
	from := time.Now()
	to := from.AddDate(1, 0, 0)
	startYear, startWeek := from.ISOWeek()
	endYear, endWeek := to.ISOWeek()

	weeks := make(map[string]WeekAvailability, endWeek-startWeek+1)
	yearDiff := endYear - startYear
	absEndWeek := endWeek + yearDiff*52
	for i := startWeek; i <= absEndWeek; i++ {
		adjustedWeekNr := i % 52
		addYears := i / 52
		week := from.AddDate(addYears, 0, 7*(adjustedWeekNr-startWeek))
		weekDateStr := week.Format("2006-01-02")
		_, weekNr := week.ISOWeek()
		humanReadWeekStr := fmt.Sprintf("Week %d", weekNr)

		weeks[weekDateStr] = WeekAvailability{
			WeekStr:   humanReadWeekStr,
			Monday:    getDefaultDayAvailability(week, "available"),
			Tuesday:   getDefaultDayAvailability(week.AddDate(0, 0, 1), randomAvailability()),
			Wednesday: getDefaultDayAvailability(week.AddDate(0, 0, 2), randomAvailability()),
			Thursday:  getDefaultDayAvailability(week.AddDate(0, 0, 3), randomAvailability()),
			Friday:    getDefaultDayAvailability(week.AddDate(0, 0, 4), randomAvailability()),
			Saturday:  getDefaultDayAvailability(week.AddDate(0, 0, 5), randomAvailability()),
			Sunday:    getDefaultDayAvailability(week.AddDate(0, 0, 6), "partial"),
		}
	}

	return EmployeeAvailability{
		Weeks: weeks,
	}
}

func randomAvailability() string {
	availabilities := []string{"available", "unavailable", "partial"}
	return availabilities[rand.Intn(len(availabilities))]
}

func getDefaultDayAvailability(date time.Time, ava string) DayAvilability {
	var from *time.Time
	var to *time.Time
	if ava == "partial" {
		f := time.Now()
		t := f.Add(8 * time.Hour)
		from = &f
		to = &t
	}
	return DayAvilability{
		Date:         date,
		Availability: ava,
		From:         from,
		To:           to,
	}
}

type EmployeesWeekAvailability struct {
	Employees map[string]WeekAvailability `json:"employees"`
}

func (es *EmployeeStore) GetAllEmployeesAvailabilityForWeek(ctx context.Context, week time.Time) (EmployeeAvailability, error) {
	allEmployees, err := es.All(ctx)
	if err != nil {
		return EmployeeAvailability{}, err
	}

	allEmails := make([]string, 0, len(allEmployees))
	for _, e := range allEmployees {
		allEmails = append(allEmails, e.Email)
	}

	weeks := make(map[string]WeekAvailability, len(allEmails))
	weekDateStr := week.Format("2006-01-02")
	for _, email := range allEmails {
		ava, err := es.Availability(ctx, email)
		if err != nil {
			return EmployeeAvailability{}, err
		}

		weekAva, ok := ava.Weeks[weekDateStr]
		if !ok {
			es.logger.Print("week not found", "week", weekDateStr, "email", email)
			return EmployeeAvailability{}, fmt.Errorf("week not found for employee %s", email)
		}

		weeks[email] = weekAva
	}

	return EmployeeAvailability{
		Weeks: weeks,
	}, nil
}
