package publisher

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/redis/go-redis/v9"
)

const (
	ChannelX402Payments        = "channel:x402_payments"
	ChannelEscrowContributions = "channel:escrow_contributions"
	ChannelNativePayments      = "channel:native_payments"
)

// Publisher wraps a Redis client and serialises event payloads to JSON
// before sending them to the given Pub/Sub channel.
type Publisher struct {
	client *redis.Client
}

// New connects to Redis and returns a Publisher. It PINGs to verify connectivity.
func New(redisURL string) (*Publisher, error) {
	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, fmt.Errorf("parse redis url: %w", err)
	}
	client := redis.NewClient(opts)
	if err := client.Ping(context.Background()).Err(); err != nil {
		return nil, fmt.Errorf("redis ping: %w", err)
	}
	return &Publisher{client: client}, nil
}

// Publish marshals payload to JSON and publishes it to the given channel.
func (p *Publisher) Publish(ctx context.Context, channel string, payload any) error {
	data, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal payload: %w", err)
	}
	if err := p.client.Publish(ctx, channel, data).Err(); err != nil {
		return fmt.Errorf("redis publish to %s: %w", channel, err)
	}
	return nil
}

// Close terminates the underlying Redis connection.
func (p *Publisher) Close() error {
	return p.client.Close()
}
