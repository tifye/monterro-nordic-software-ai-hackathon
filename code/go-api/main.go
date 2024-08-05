package main

import (
	"airdock/api"
	"airdock/store"
	"airdock/store/business"
	"context"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/signal"
	"time"

	"github.com/charmbracelet/log"
	"github.com/spf13/viper"
	"github.com/subosito/gotenv"
)

func run(ctx context.Context, w io.Writer, config *viper.Viper, _ []string) error {
	ctx, cancel := signal.NotifyContext(ctx, os.Interrupt)
	defer cancel()

	err := gotenv.Load()
	if err != nil {
		log.Warn("failed to load .env file", "err", err)
	}

	logger := log.Default()
	logger.SetOutput(w)

	cbCluster, err := store.InitCouchBase(ctx, config)
	if err != nil {
		return err
	}
	cbCtx, cancel := context.WithTimeout(ctx, time.Second*120)
	defer cancel()
	mainBucket, err := store.NewMainBucket(cbCtx, config, cbCluster)
	if err != nil {
		return err
	}
	itemsStore := store.NewItemStore(mainBucket, logger)
	eStore := store.NewEmployeeStore(mainBucket, logger)
	bStore := business.NewBusinessStore(mainBucket, logger)

	server := api.NewServer(
		config,
		logger,
		&itemsStore,
		&eStore,
		&bStore,
	)

	config.SetDefault("HTTP_PORT", 9546)
	port := config.GetInt("HTTP_PORT")

	go func() {
		ln, err := net.Listen("tcp", fmt.Sprintf("0.0.0.0:%d", port))
		if err != nil {
			logger.Fatal("failed to listen", "err", err)
		}

		logger.Print("Serving...")
		err = server.Serve(ln)
		if err != nil && err != http.ErrServerClosed {
			logger.Fatal("received error from http server", "err", err)
		}
	}()

	<-ctx.Done()

	ctx, cancel = context.WithTimeout(context.Background(), time.Second*10)
	defer cancel()
	err = server.Shutdown(ctx)
	if err != nil {
		return fmt.Errorf("error when shutting down server: %w", err)
	}

	return nil
}

func main() {
	config := viper.New()
	config.AutomaticEnv()
	ctx := context.Background()
	err := run(ctx, os.Stdout, config, os.Args[1:])
	if err != nil {
		log.Fatal("failed to run", "err", err)
	}
}
