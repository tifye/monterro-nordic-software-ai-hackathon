package api

import (
	"airdock/store"
	"net/http"
	"strconv"
	"time"

	"github.com/charmbracelet/log"
	"github.com/labstack/echo/v4"
)

type EmployeeDTO struct {
	Name             string `json:"name"`
	Email            string `json:"email"`
	Address          string `json:"address"`
	DateOfBirth      string `json:"dateOfBirth"`
	EmergencyContact string `json:"emergencyContact"`
}

func mapEmployeeToDTO(e store.Employee) EmployeeDTO {
	return EmployeeDTO{
		Name:             e.Name,
		Email:            e.Email,
		Address:          e.Address,
		DateOfBirth:      time.Unix(e.DateOfBirth, 0).Format("2006-01-02"),
		EmergencyContact: strconv.FormatInt(e.EmergencyContact, 10),
	}
}

func handleCreateEmployee(eStore *store.EmployeeStore, logger *log.Logger) echo.HandlerFunc {
	type request struct {
		Name             string `json:"name" validate:"required"`
		Email            string `json:"email" validate:"required,email"`
		Address          string `json:"address" validate:"required"`
		DateOfBirth      string `json:"dateOfBirth" validate:"required"`
		EmergencyContact string `json:"emergencyContact" validate:"required,numeric"`
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

		dob, err := time.Parse("2006-01-02", req.DateOfBirth)
		if err != nil {
			return ctx.String(http.StatusBadRequest, "invalid date format, expected format is YYYY-MM-DD")
		}

		ec, err := strconv.Atoi(req.EmergencyContact)
		if err != nil {
			return ctx.String(http.StatusBadRequest, "invalid emergency contact, expected a number")
		}

		employee := store.Employee{
			Name:             req.Name,
			Email:            req.Email,
			Address:          req.Address,
			DateOfBirth:      dob.Unix(),
			EmergencyContact: int64(ec),
		}

		err = eStore.Create(ctx.Request().Context(), employee)
		if err != nil {
			logger.Warn(err)
			return echo.NewHTTPError(http.StatusInternalServerError)
		}

		return ctx.JSON(http.StatusCreated, mapEmployeeToDTO(employee))
	}
}

func handleGetEmployee(eStore *store.EmployeeStore, logger *log.Logger) echo.HandlerFunc {
	type request struct {
		Email string `param:"email" validate:"required,email"`
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

		employee, err := eStore.Get(ctx.Request().Context(), req.Email)
		if err != nil {
			logger.Warn(err)
			return echo.NewHTTPError(http.StatusNotFound)
		}

		return ctx.JSON(http.StatusOK, mapEmployeeToDTO(employee))
	}
}

func handleDeleteEmployee(eStore *store.EmployeeStore, logger *log.Logger) echo.HandlerFunc {
	type request struct {
		Email string `param:"email" validate:"required,email"`
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

		err = eStore.Delete(ctx.Request().Context(), req.Email)
		if err != nil {
			logger.Warn(err)
			return echo.NewHTTPError(http.StatusNotFound)
		}

		return ctx.NoContent(http.StatusNoContent)
	}
}

func handleGetAllEmployees(eStore *store.EmployeeStore, logger *log.Logger) echo.HandlerFunc {
	return func(ctx echo.Context) error {
		employees, err := eStore.All(ctx.Request().Context())
		if err != nil {
			logger.Warn(err)
			return echo.NewHTTPError(http.StatusInternalServerError)
		}

		res := make([]EmployeeDTO, 0, len(employees))
		for _, e := range employees {
			res = append(res, mapEmployeeToDTO(e))
		}

		return ctx.JSON(http.StatusOK, res)
	}
}

func handleGetEmployeeAvailability(eStore *store.EmployeeStore, logger *log.Logger) echo.HandlerFunc {
	type request struct {
		Email string `param:"email" validate:"required,email"`
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

		availability, err := eStore.Availability(ctx.Request().Context(), req.Email)
		if err != nil {
			logger.Warn(err)
			return echo.NewHTTPError(http.StatusNotFound)
		}

		return ctx.JSON(http.StatusOK, availability)
	}
}

func handleGetAllEmployeeAvailabilityForWeek(eStore *store.EmployeeStore, logger *log.Logger) echo.HandlerFunc {
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

		week, err := time.Parse("2006-01-02", req.Week)
		if err != nil {
			return ctx.String(http.StatusBadRequest, "invalid date format, expected format is YYYY-MM-DD")
		}

		availability, err := eStore.GetAllEmployeesAvailabilityForWeek(ctx.Request().Context(), week)
		if err != nil {
			logger.Warn(err)
			return echo.NewHTTPError(http.StatusInternalServerError)
		}

		return ctx.JSON(http.StatusOK, availability)
	}
}

func handleSetAvaMeep(eStore *store.EmployeeStore, logger *log.Logger) echo.HandlerFunc {
	type ava struct {
		Availability string `json:"availability" validate:"required"`
	}
	type request struct {
		Email string `param:"email" validate:"required,email"`
		Week  string `param:"week" validate:"required,datetime=2006-01-02"`
		Ava   ava    `json:"ava" validate:"required"`
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

		week, err := time.Parse("2006-01-02", req.Week)
		if err != nil {
			return ctx.String(http.StatusBadRequest, "invalid date format, expected format is YYYY-MM-DD")
		}

		logger.Printf("setting availability for %v on %v", req.Email, week.Format("2006-01-02"))

		return ctx.NoContent(http.StatusNoContent)
	}
}
