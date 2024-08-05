package store

import (
	"context"
	"time"

	"github.com/couchbase/gocb/v2"
	"github.com/spf13/viper"
)

func InitCouchBase(ctx context.Context, config *viper.Viper) (*gocb.Cluster, error) {
	type response struct {
		cluster *gocb.Cluster
		err     error
	}

	respch := make(chan response)
	go func() {
		// trust couchbase error to provide info if any of these are missing
		conStr := config.GetString("COUCHBASE_URL")
		cluster, err := gocb.Connect(conStr, gocb.ClusterOptions{
			Authenticator: gocb.PasswordAuthenticator{
				Username: config.GetString("COUCHBASE_USERNAME"),
				Password: config.GetString("COUCHBASE_PASSWORD"),
			},
		})
		respch <- response{cluster: cluster, err: err}
	}()

	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case resp := <-respch:
		return resp.cluster, resp.err
	}
}

func NewMainBucket(ctx context.Context, config *viper.Viper, cluster *gocb.Cluster) (*gocb.Bucket, error) {
	config.SetDefault("COUCHBASE_BUCKET", "main")
	bucket := cluster.Bucket(config.GetString("COUCHBASE_BUCKET"))
	err := bucket.WaitUntilReady(time.Second*60, &gocb.WaitUntilReadyOptions{
		Context: ctx,
	})
	return bucket, err
}
