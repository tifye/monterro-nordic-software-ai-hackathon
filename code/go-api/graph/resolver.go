package graph

//go:generate go run github.com/99designs/gqlgen generate

import (
	"airdock/store"

	"github.com/charmbracelet/log"
)

// This file will not be regenerated automatically.
//
// It serves as dependency injection for your app, add any dependencies you require here.

type Resolver struct {
	itemsStore *store.ItemsStore
	logger     *log.Logger
}

func NewResolver(itemStore *store.ItemsStore, logger *log.Logger) *Resolver {
	return &Resolver{
		itemsStore: itemStore,
		logger:     logger,
	}
}
