package api

import (
	"airdock/store/business"
	"errors"
	"net/http"
	"time"

	"github.com/charmbracelet/log"
	"github.com/labstack/echo/v4"
)

type shift struct {
	From              string `json:"from" validate:"required,datetime=15:04"`
	To                string `json:"to" validate:"required,datetime=15:04"`
	RequiredEmployees int    `json:"requiredEmployees" validate:"required,number"`
}
type day struct {
	Shifts []shift `json:"shifts" validate:"required,dive"`
}
type setDefaultTimetableRequest struct {
	Monday    day `json:"monday" validate:"required"`
	Tuesday   day `json:"tuesday" validate:"required"`
	Wednesday day `json:"wednesday" validate:"required"`
	Thursday  day `json:"thursday" validate:"required"`
	Friday    day `json:"friday" validate:"required"`
	Saturday  day `json:"saturday" validate:"required"`
	Sunday    day `json:"sunday" validate:"required"`
}

func (r setDefaultTimetableRequest) mapToBusiness() (business.WeekTimetable, error) {
	monday, err := mapDay(r.Monday)
	if err != nil {
		return business.WeekTimetable{}, err
	}
	tuesday, err := mapDay(r.Tuesday)
	if err != nil {
		return business.WeekTimetable{}, err
	}
	wednesday, err := mapDay(r.Wednesday)
	if err != nil {
		return business.WeekTimetable{}, err
	}
	thursday, err := mapDay(r.Thursday)
	if err != nil {
		return business.WeekTimetable{}, err
	}
	friday, err := mapDay(r.Friday)
	if err != nil {
		return business.WeekTimetable{}, err
	}
	saturday, err := mapDay(r.Saturday)
	if err != nil {
		return business.WeekTimetable{}, err
	}
	sunday, err := mapDay(r.Sunday)
	if err != nil {
		return business.WeekTimetable{}, err
	}

	return business.WeekTimetable{
		Monday:    monday,
		Tuesday:   tuesday,
		Wednesday: wednesday,
		Thursday:  thursday,
		Friday:    friday,
		Saturday:  saturday,
		Sunday:    sunday,
	}, nil
}

func mapDay(day day) (business.DayTimetable, error) {
	shifts, err := mapShifts(day.Shifts)
	if err != nil {
		return business.DayTimetable{}, err
	}
	return business.DayTimetable{
		Shifts: shifts,
	}, nil
}

func mapShifts(dtoShifts []shift) ([]business.ShiftTimetable, error) {
	shifts := make([]business.ShiftTimetable, 0, len(dtoShifts))
	for _, s := range dtoShifts {
		from, err := time.Parse("15:04", s.From)
		if err != nil {
			return nil, err
		}
		to, err := time.Parse("15:04", s.To)
		if err != nil {
			return nil, err
		}

		stt := business.ShiftTimetable{
			From:              from,
			To:                to,
			RequiredEmployees: s.RequiredEmployees,
		}
		shifts = append(shifts, stt)
	}
	return shifts, nil
}

func handleSetDefaultTimetable(bStore *business.BusinessStore, logger *log.Logger) echo.HandlerFunc {
	return func(ctx echo.Context) error {
		var req setDefaultTimetableRequest
		err := ctx.Bind(&req)
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest)
		}
		err = ctx.Validate(req)
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, err.Error())
		}

		wtt, err := req.mapToBusiness()
		if err != nil {
			logger.Warn(err)
			return echo.NewHTTPError(http.StatusBadRequest, err.Error())
		}

		err = bStore.SetDefaultTimetable(ctx.Request().Context(), wtt)
		if err != nil {
			logger.Warn(err)
			return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
		}

		return ctx.NoContent(http.StatusOK)
	}
}

func handleGetDefaultTimetable(bStore *business.BusinessStore, logger *log.Logger) echo.HandlerFunc {
	return func(ctx echo.Context) error {
		tt, err := bStore.GetDefaultTimetable(ctx.Request().Context())
		if errors.Is(err, business.ErrConfigNotFound) {
			return ctx.String(http.StatusNotFound, "default timetable not yet set")
		}
		if err != nil {
			logger.Warn(err)
			return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
		}

		return ctx.JSON(http.StatusOK, tt)
	}
}

func handleGetTimetable(bStore *business.BusinessStore, logger *log.Logger) echo.HandlerFunc {
	type request struct {
		From string `query:"from" validate:"required,datetime=2006-01-02"`
		To   string `query:"to" validate:"required,datetime=2006-01-02"`
	}
	return func(ctx echo.Context) error {
		var req request
		err := ctx.Bind(&req)
		if err != nil {
			logger.Warn(err)
			return echo.NewHTTPError(http.StatusBadRequest, err)
		}
		err = ctx.Validate(req)
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, err.Error())
		}

		from, err := time.Parse(time.DateOnly, req.From)
		if err != nil {
			logger.Warn(err)
			return echo.NewHTTPError(http.StatusBadRequest, err)
		}
		to, err := time.Parse(time.DateOnly, req.To)
		if err != nil {
			logger.Warn(err)
			return echo.NewHTTPError(http.StatusBadRequest, err)
		}

		tt, err := bStore.GetTimetable(ctx.Request().Context(), from, to)
		if err != nil {
			logger.Warn(err)
			return echo.NewHTTPError(http.StatusInternalServerError, err)
		}

		return ctx.JSON(http.StatusOK, tt)
	}
}

func handleCreateScheduleForWeek(bStore *business.BusinessStore, logger *log.Logger) echo.HandlerFunc {
	type shiftSchedule struct {
		From      string   `json:"from" validate:"required,datetime=15:04"`
		To        string   `json:"to" validate:"required,datetime=15:04"`
		Employees []string `json:"employees" validate:"required,dive,email"`
	}
	type daySchedule struct {
		Shifts []shiftSchedule `json:"shifts" validate:"required,dive"`
	}
	type weekSchedule struct {
		Monday    daySchedule `json:"monday" validate:"required"`
		Tuesday   daySchedule `json:"tuesday" validate:"required"`
		Wednesday daySchedule `json:"wednesday" validate:"required"`
		Thursday  daySchedule `json:"thursday" validate:"required"`
		Friday    daySchedule `json:"friday" validate:"required"`
		Saturday  daySchedule `json:"saturday" validate:"required"`
		Sunday    daySchedule `json:"sunday" validate:"required"`
	}
	type request struct {
		Week     string                `param:"week" validate:"required,datetime=2006-01-02"`
		Schedule business.WeekSchedule `json:"schedule" validate:"required"`
	}
	return func(ctx echo.Context) error {
		var req request
		err := ctx.Bind(&req)
		if err != nil {
			logger.Warn(err)
			return echo.NewHTTPError(http.StatusBadRequest)
		}
		err = ctx.Validate(req)
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, err.Error())
		}

		logger.Printf("creating schedule for week %v", req)

		week, err := time.Parse(time.DateOnly, req.Week)
		if err != nil {
			logger.Warn(err)
			return echo.NewHTTPError(http.StatusBadRequest, err)
		}

		err = bStore.CreateScheduleForWeek(ctx.Request().Context(), week, req.Schedule)
		if err != nil {
			logger.Warn(err)
			return echo.NewHTTPError(http.StatusInternalServerError, err)
		}

		return ctx.NoContent(http.StatusCreated)
	}
}

func handleGetScheduleForWeek(bStore *business.BusinessStore, logger *log.Logger) echo.HandlerFunc {
	type request struct {
		Week string `param:"week" validate:"required,datetime=2006-01-02"`
	}
	return func(ctx echo.Context) error {
		var req request
		err := ctx.Bind(&req)
		if err != nil {
			logger.Warn(err)
			return echo.NewHTTPError(http.StatusBadRequest)
		}
		err = ctx.Validate(req)
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, err.Error())
		}

		week, err := time.Parse(time.DateOnly, req.Week)
		if err != nil {
			logger.Warn(err)
			return echo.NewHTTPError(http.StatusBadRequest, err)
		}

		schedule, err := bStore.GetScheduleForWeek(ctx.Request().Context(), week)
		if err != nil {
			logger.Warn(err)
			return echo.NewHTTPError(http.StatusInternalServerError, err)
		}

		return ctx.JSON(http.StatusOK, schedule)
	}
}
