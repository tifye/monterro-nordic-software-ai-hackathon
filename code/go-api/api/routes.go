package api

import (
	"airdock/store"
	"airdock/store/business"
	"crypto/tls"
	"encoding/json"
	"net/http"

	"github.com/99designs/gqlgen/graphql/handler"
	"github.com/99designs/gqlgen/graphql/playground"
	"github.com/charmbracelet/log"
	"github.com/golang-jwt/jwt"
	echojwt "github.com/labstack/echo-jwt/v4"
	"github.com/labstack/echo/v4"
	"github.com/spf13/viper"
)

func registerRoutes(
	e *echo.Echo,
	_ *viper.Viper,
	logger *log.Logger,
	gqlServ *handler.Server,
	itemsStore *store.ItemsStore,
	eStore *store.EmployeeStore,
	bStore *business.BusinessStore,
) {
	e.GET("/", handleIndex(itemsStore, logger))
	e.PUT("/item", handleCreateItem(itemsStore, logger))
	e.GET("/item/:id", handleGetItem(itemsStore, logger))
	e.DELETE("/item/:id", handleDeleteItem(itemsStore, logger))

	e.PUT("/employee", handleCreateEmployee(eStore, logger))
	e.DELETE("/employee/:email", handleDeleteEmployee(eStore, logger))
	e.GET("/employee/:email", handleGetEmployee(eStore, logger))
	e.GET("/employee/:email/availability", handleGetEmployeeAvailability(eStore, logger))
	e.GET("/employees", handleGetAllEmployees(eStore, logger))
	e.GET("/employees/availability/week/:week", handleGetAllEmployeeAvailabilityForWeek(eStore, logger))
	e.PUT("/employee/:email/availability/:week", handleSetAvaMeep(eStore, logger))

	e.GET("/business/timetable", handleGetTimetable(bStore, logger))
	e.GET("/business/timetable/default", handleGetDefaultTimetable(bStore, logger))
	e.PUT("/business/timetable/default", handleSetDefaultTimetable(bStore, logger))
	e.PUT("/business/schedule/:week", handleCreateScheduleForWeek(bStore, logger))
	e.GET("/business/schedule/:week", handleGetScheduleForWeek(bStore, logger))

	e.Any("/query", func(ctx echo.Context) error {
		// ctx.Request().Header.Set("Content-Type", "application/json")
		gqlServ.ServeHTTP(ctx.Response().Writer, ctx.Request())
		return nil
	})
	e.GET("/query/playground", func(ctx echo.Context) error {
		h := playground.Handler("GraphQL playground", "/query")
		h.ServeHTTP(ctx.Response().Writer, ctx.Request())
		return nil
	})

}

type claims struct {
	Username string `json:"sub"`
}

func requireUser(config *viper.Viper, logger *log.Logger) echo.MiddlewareFunc {
	client := &http.Client{
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{
				InsecureSkipVerify: true,
			},
		},
	}

	type keysResp struct {
		Keys []map[string]interface{} `json:"keys"`
	}

	res, err := client.Get(config.GetString("AUTH_OIDC_JWK_URL"))
	if err != nil {
		logger.Fatal(err)
	}
	defer res.Body.Close()

	var keys keysResp
	decoder := json.NewDecoder(res.Body)
	err = decoder.Decode(&keys)
	if err != nil {
		logger.Fatal(err)
	}

	logger.Printf("%q", keys)

	jwtConfig := echojwt.Config{
		SuccessHandler: func(ctx echo.Context) {
			user := ctx.Get("user").(*jwt.Token)
			claims := claims{}
			tmp, _ := json.Marshal(user.Claims)
			_ = json.Unmarshal(tmp, &claims)
			ctx.Set("claims", claims)
		},
		SigningKeys: keys.Keys[0],
	}
	return echojwt.WithConfig(jwtConfig)
}

func handleIndex(itemsStore *store.ItemsStore, logger *log.Logger) echo.HandlerFunc {
	return func(ctx echo.Context) error {
		items, err := itemsStore.AllItems(ctx.Request().Context())
		if err != nil {
			logger.Warn(err)
			return echo.NewHTTPError(http.StatusInternalServerError)
		}

		ctx.JSON(http.StatusOK, items)
		return nil
	}
}

func handleGetItem(itemsStore *store.ItemsStore, logger *log.Logger) echo.HandlerFunc {
	type request struct {
		Id string `param:"id"`
	}
	return func(ctx echo.Context) error {
		var req request
		err := ctx.Bind(&req)
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest)
		}

		item, err := itemsStore.GetItem(ctx.Request().Context(), req.Id)
		if err != nil {
			logger.Warn(err)
			return echo.NewHTTPError(http.StatusInternalServerError)
		}

		return ctx.JSON(http.StatusOK, item)
	}
}

// Todo: use validation
func handleCreateItem(itemsStore *store.ItemsStore, logger *log.Logger) echo.HandlerFunc {
	type request struct {
		Name string `json:"name"`
	}
	return func(ctx echo.Context) error {
		var req request
		err := ctx.Bind(&req)
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest)
		}

		item, err := itemsStore.CreateItem(ctx.Request().Context(), req.Name)
		if err != nil {
			logger.Warn(err)
			return echo.NewHTTPError(http.StatusInternalServerError)
		}

		return ctx.JSON(http.StatusOK, item)
	}
}

func handleDeleteItem(itemsStore *store.ItemsStore, logger *log.Logger) echo.HandlerFunc {
	type request struct {
		Id string `param:"id"`
	}
	return func(ctx echo.Context) error {
		var req request
		err := ctx.Bind(&req)
		if err != nil {
			return echo.ErrBadRequest
		}

		err = itemsStore.RemoveItem(ctx.Request().Context(), req.Id)
		if err != nil {
			logger.Error(err)
			return echo.ErrInternalServerError
		}

		return ctx.NoContent(http.StatusOK)
	}
}
