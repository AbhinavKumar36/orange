-- Migration: Add food_classification column to products
-- Supports: vegetarian, non_vegetarian, or NULL (for non-food/unclassified items)

ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS food_classification VARCHAR(30) NULL;

-- Add check constraint for allowed food classification values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_food_classification_check'
  ) THEN
    ALTER TABLE public.products
    ADD CONSTRAINT products_food_classification_check
    CHECK (food_classification IS NULL OR food_classification IN ('vegetarian', 'non_vegetarian'));
  END IF;
END $$;

-- Synchronize existing records based on is_veg boolean
UPDATE public.products
SET food_classification = CASE 
  WHEN is_veg = true THEN 'vegetarian'
  ELSE 'non_vegetarian'
END
WHERE food_classification IS NULL;

COMMENT ON COLUMN public.products.food_classification IS 'Food classification: vegetarian, non_vegetarian, or NULL for non-food items.';
