package main

import (
	"context"
	"log"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgxpool"

	"lotus-warden/services/internal/config"
	"lotus-warden/services/internal/db"
)

type healthResponse struct {
	Service string `json:"service"`
	Status  string `json:"status"`
}

type product struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

func main() {
	cfg := config.Load("api")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	pool, err := db.Connect(ctx, cfg.PostgresDSN)
	if err != nil {
		log.Fatalf("db connection failed: %v", err)
	}
	defer pool.Close()

	app := fiber.New()

	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(healthResponse{Service: cfg.ServiceName, Status: "ok"})
	})

	app.Get("/v1/products", func(c *fiber.Ctx) error {
		items, err := listProducts(c.Context(), pool)
		if err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, err.Error())
		}
		return c.JSON(items)
	})

	log.Printf("api listening on %s", cfg.HTTPAddr)
	if err := app.Listen(cfg.HTTPAddr); err != nil {
		log.Fatalf("http server failed: %v", err)
	}
}

func listProducts(ctx context.Context, pool *pgxpool.Pool) ([]product, error) {
	rows, err := pool.Query(ctx, `select id::text, name from products order by name limit 50`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]product, 0)
	for rows.Next() {
		var item product
		if err := rows.Scan(&item.ID, &item.Name); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}
