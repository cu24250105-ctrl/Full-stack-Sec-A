-- Part (a)
-- Top 3 products by revenue within each category

WITH product_revenue AS (
    SELECT
        p.id,
        p.name,
        p.category,
        SUM(p.price * oi.qty) AS revenue
    FROM products p
    JOIN order_items oi
        ON p.id = oi.product_id
    JOIN orders o
        ON oi.order_id = o.id
    GROUP BY
        p.id,
        p.name,
        p.category
),
ranked_products AS (
    SELECT
        id,
        name,
        category,
        revenue,
        DENSE_RANK() OVER (
            PARTITION BY category
            ORDER BY revenue DESC
        ) AS revenue_rank
    FROM product_revenue
)
SELECT
    id,
    name,
    category,
    revenue,
    revenue_rank
FROM ranked_products
WHERE revenue_rank <= 3
ORDER BY category, revenue_rank;

-- Part (b)
-- Customers who placed at least one order
-- in January, February and March 2025

SELECT
    c.id,
    c.name,
    c.city
FROM customers c
JOIN orders o
    ON c.id = o.customer_id
WHERE o.order_date >= '2025-01-01'
  AND o.order_date < '2025-04-01'
GROUP BY
    c.id,
    c.name,
    c.city
HAVING COUNT(DISTINCT EXTRACT(MONTH FROM o.order_date)) = 3;

-- Part (c)
-- Place an order without overselling

BEGIN;

UPDATE products
SET stock = stock - :qty
WHERE id = :product_id
  AND stock >= :qty;

-- Check that exactly one row was updated.
-- If 0 rows were updated, ROLLBACK and report failure.

INSERT INTO orders (customer_id, order_date)
VALUES (:customer_id, CURRENT_TIMESTAMP);

INSERT INTO order_items (order_id, product_id, qty)
VALUES (LAST_INSERT_ID(), :product_id, :qty);

COMMIT;