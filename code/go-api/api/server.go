package api

import (
	"airdock/graph"
	"airdock/store"
	"airdock/store/business"
	"net/http"
	"time"

	"github.com/99designs/gqlgen/graphql/handler"
	"github.com/99designs/gqlgen/graphql/handler/transport"
	"github.com/charmbracelet/log"
	"github.com/go-playground/validator/v10"
	"github.com/gorilla/websocket"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"github.com/spf13/viper"
)

func NewServer(
	config *viper.Viper,
	logger *log.Logger,
	itemsStore *store.ItemsStore,
	eStore *store.EmployeeStore,
	bStore *business.BusinessStore,
) *http.Server {
	e := echo.New()

	server := http.Server{
		Handler:           e,
		ReadTimeout:       15 * time.Second,
		IdleTimeout:       30 * time.Second,
		WriteTimeout:      15 * time.Second,
		ReadHeaderTimeout: 5 * time.Second,
		ErrorLog:          logger.StandardLog(),
	}

	e.Validator = &CustomValidator{validator: validator.New(validator.WithRequiredStructEnabled())}

	e.Use(
		middleware.Logger(),
		middleware.Recover(),
	)

	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins: []string{"*"},
		AllowMethods: []string{http.MethodGet, http.MethodPost, http.MethodOptions, http.MethodDelete, http.MethodPut, http.MethodHead},
		//AllowHeaders:     []string{echo.HeaderOrigin, echo.HeaderContentType, echo.HeaderAccept, echo.HeaderXRequestedWith, echo.HeaderAuthorization},
		AllowCredentials: true,
	}))

	schema := graph.NewExecutableSchema(
		graph.Config{
			Resolvers: graph.NewResolver(itemsStore, logger),
		},
	)
	gqlServ := handler.New(schema)
	gqlServ.AddTransport(transport.POST{})
	gqlServ.AddTransport(transport.Options{})
	gqlServ.AddTransport(transport.GET{})
	gqlServ.AddTransport(&transport.Websocket{
		Upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				return true
			},
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
		},
	})
	gqlServ.AddTransport(transport.GRAPHQL{})

	registerRoutes(
		e,
		config,
		logger,
		gqlServ,
		itemsStore,
		eStore,
		bStore,
	)

	return &server
}

type CustomValidator struct {
	validator *validator.Validate
}

func (cv *CustomValidator) Validate(i interface{}) error {
	if err := cv.validator.Struct(i); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	return nil
}
