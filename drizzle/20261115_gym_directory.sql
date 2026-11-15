-- ADDITIVE ONLY: reviewed/applied by parent; no existing health/workout tables touched.
-- UTC timestamptz; no seed inserts; addresses only, no inferred branch inventory.
BEGIN;
CREATE TABLE IF NOT EXISTS gym_locations (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name varchar(255) NOT NULL,
  address text NOT NULL,
  country varchar(100),
  brand varchar(100),
  source varchar(30) NOT NULL DEFAULT 'owner_saved',
  source_url text,
  place_id varchar(255),
  identity_key varchar(64) NOT NULL,
  latitude real,
  longitude real,
  source_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gym_locations_owner_id_unique UNIQUE (user_id, id),
  CONSTRAINT gym_locations_owner_identity_unique UNIQUE (user_id, identity_key),
  CONSTRAINT gym_locations_owner_place_unique UNIQUE (user_id, place_id),
  CONSTRAINT gym_locations_source_check CHECK (source IN ('owner_saved', 'official_seed', 'google_places')),
  CONSTRAINT gym_locations_coordinates_check CHECK (
    (latitude IS NULL AND longitude IS NULL) OR
    (latitude IS NOT NULL AND longitude IS NOT NULL AND latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)
  )
);
CREATE INDEX IF NOT EXISTS gym_locations_owner_name_idx ON gym_locations(user_id, name, id);
CREATE TABLE IF NOT EXISTS gym_equipment (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  gym_id integer NOT NULL,
  machine_key varchar(150) NOT NULL,
  display_name varchar(255) NOT NULL,
  equipment varchar(30) NOT NULL,
  source varchar(30) NOT NULL,
  notes text,
  source_url text,
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gym_equipment_owner_gym_fk FOREIGN KEY (user_id, gym_id)
    REFERENCES gym_locations(user_id, id) ON DELETE CASCADE,
  CONSTRAINT gym_equipment_owner_machine_unique UNIQUE (user_id, gym_id, machine_key),
  CONSTRAINT gym_equipment_source_check CHECK (source IN ('owner_confirmed', 'photo_confirmed')),
  CONSTRAINT gym_equipment_equipment_check CHECK (equipment IN ('Machine','Cable','Barbell','Dumbbell','Bodyweight','Kettlebell','Band','Cardio','Other'))
);
CREATE INDEX IF NOT EXISTS gym_equipment_owner_gym_idx ON gym_equipment(user_id, gym_id, id);
-- The server uses its existing trusted direct PostgreSQL connection. Block anonymous
-- Supabase Data API access; do not add public policies to these personal records.
ALTER TABLE gym_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE gym_equipment ENABLE ROW LEVEL SECURITY;
COMMIT;
