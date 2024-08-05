package store

import (
	"context"
	"fmt"
	"sync"

	"github.com/charmbracelet/log"
	"github.com/couchbase/gocb/v2"
	"github.com/google/uuid"
)

type ItemsStore struct {
	bucket *gocb.Bucket
	scope  *gocb.Scope
	col    *gocb.Collection
	logger *log.Logger

	observers []chan<- Item
	obsMu     *sync.RWMutex
}

type Item struct {
	Id   string `json:"id"`
	Name string `json:"name"`
}

func NewItemStore(bucket *gocb.Bucket, logger *log.Logger) ItemsStore {
	scope := bucket.DefaultScope()
	col := scope.Collection("items")
	return ItemsStore{
		bucket:    bucket,
		scope:     scope,
		col:       col,
		logger:    logger,
		observers: make([]chan<- Item, 0),
		obsMu:     &sync.RWMutex{},
	}
}

func (is *ItemsStore) Register(ch chan<- Item) {
	is.obsMu.Lock()
	defer is.obsMu.Unlock()
	is.observers = append(is.observers, ch)
}

func (is *ItemsStore) Unregister(ch chan<- Item) {
	is.obsMu.Lock()
	defer is.obsMu.Unlock()
	idx := -1
	for i, obs := range is.observers {
		if obs == ch {
			idx = i
			break
		}
	}
	if idx < 0 {
		return
	}

	newObs := make([]chan<- Item, 0, len(is.observers)-1)
	newObs = append(newObs, is.observers[:idx]...)
	newObs = append(newObs, is.observers[idx+1:]...)
	is.observers = newObs
}

func (is *ItemsStore) notify(item Item) {
	is.obsMu.RLock()
	defer is.obsMu.RUnlock()
	for _, o := range is.observers {
		o <- item
	}
}

func (is ItemsStore) AllItems(ctx context.Context) ([]Item, error) {
	res, err := is.scope.Query(
		"SELECT x.*, META().id FROM items x",
		&gocb.QueryOptions{
			Context: ctx,
		},
	)
	if err != nil {
		return nil, fmt.Errorf("error during query, got: %s", err)
	}
	defer res.Close() // ignore error

	var items []Item // maybe should allocate some memory ahead of time?
	for res.Next() {
		var item Item
		err := res.Row(&item)
		if err != nil {
			return nil, err
		}
		items = append(items, item)

		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		default:
		}
	}

	return items, res.Err()
}

func (is ItemsStore) GetItem(ctx context.Context, id string) (Item, error) {
	res, err := is.col.Get(id, &gocb.GetOptions{
		Context: ctx,
	})
	if err != nil {
		return Item{}, err
	}

	var item Item
	err = res.Content(&item)
	item.Id = id
	return item, err
}

func (is ItemsStore) CreateItem(ctx context.Context, name string) (Item, error) {
	id, err := uuid.NewRandom()
	if err != nil {
		return Item{}, err
	}

	itemDoc := struct {
		Name string `json:"name"`
	}{
		Name: name,
	}
	_, err = is.col.Insert(id.String(), itemDoc, &gocb.InsertOptions{
		Context: ctx,
	})
	if err != nil {
		return Item{}, err
	}

	item := Item{
		Id:   id.String(),
		Name: name,
	}

	go func(item Item) {
		is.notify(item)
	}(item)

	return item, nil
}

func (is ItemsStore) RemoveItem(ctx context.Context, id string) error {
	_, err := is.col.Remove(id, &gocb.RemoveOptions{
		Context:         ctx,
		DurabilityLevel: gocb.DurabilityLevelNone,
	})
	return err
}
