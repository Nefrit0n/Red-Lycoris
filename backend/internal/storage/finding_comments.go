package storage

import (
	"context"
	"database/sql"
	"time"

	"red-lycoris/backend/internal/models"

	"github.com/google/uuid"
)

type FindingCommentItem struct {
	ID             uuid.UUID
	FindingID      uuid.UUID
	AuthorID       uuid.NullUUID
	Body           string
	CreatedAt      time.Time
	AuthorUsername sql.NullString
}

func ListFindingComments(ctx context.Context, db *sql.DB, findingID uuid.UUID) ([]FindingCommentItem, error) {
	rows, err := db.QueryContext(
		ctx,
		`SELECT fc.id, fc.finding_id, fc.author_id, fc.body, fc.created_at, u.username
		 FROM finding_comments fc
		 LEFT JOIN users u ON u.id = fc.author_id
		 WHERE fc.finding_id = $1
		 ORDER BY fc.created_at DESC`,
		findingID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	comments := []FindingCommentItem{}
	for rows.Next() {
		var item FindingCommentItem
		if err := rows.Scan(&item.ID, &item.FindingID, &item.AuthorID, &item.Body, &item.CreatedAt, &item.AuthorUsername); err != nil {
			return nil, err
		}
		comments = append(comments, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return comments, nil
}

func CreateFindingComment(ctx context.Context, db *sql.DB, comment *models.FindingComment) error {
	if err := comment.Validate(); err != nil {
		return err
	}
	comment.PrepareForInsert()

	var authorID interface{}
	if comment.AuthorID != nil {
		authorID = *comment.AuthorID
	}

	_, err := db.ExecContext(
		ctx,
		`INSERT INTO finding_comments (id, finding_id, author_id, body, created_at)
		 VALUES ($1, $2, $3, $4, $5)`,
		comment.ID,
		comment.FindingID,
		authorID,
		comment.Body,
		comment.CreatedAt,
	)
	return err
}
