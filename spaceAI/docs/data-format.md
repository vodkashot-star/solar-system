# Data Format

Understanding the celestial datasets provided by SpaceAI.

## Dataset Structure

All datasets are CSV files with a consistent format.

## Celestial Objects (`celestial_objects.csv`)

The primary training dataset — 47 rows, 12 columns:

| Column            | Type   | Description                        | Examples                        |
| ----------------- | ------ | ---------------------------------- | ------------------------------- |
| `name`            | string | Object name                        | Sun, Earth, Pluto               |
| `orbital_period`  | float  | Days to complete one orbit         | 88, 365.25, 4333                |
| `axial_tilt`      | float  | Tilt angle in degrees              | 23.44, 97.77, 0.034             |
| `mass`            | float  | Mass relative to Earth             | 1.0, 317.8, 0.055               |
| `radius`          | float  | Radius relative to Earth           | 1.0, 11.209, 0.383              |
| `eccentricity`    | float  | Orbit shape (0=circle, <1=ellipse) | 0.017, 0.205, 0.0               |
| `density`         | float  | Mean density in g/cm³              | 5.51, 1.33, 0.69                |
| `gravity`         | float  | Surface gravity in m/s²            | 9.81, 24.79, 274.0              |
| `temperature`     | float  | Surface/effective temperature (K)  | 288, 165, 5778                  |
| `semi_major_axis` | float  | Average distance from Sun in AU    | 1.0, 5.2, 19.2                  |
| `inclination`     | float  | Orbital inclination in degrees     | 0, 1.3, 7.0                     |
| `rotation_period` | float  | Length of day in hours             | 24, 9.9, -5832 (retrograde)     |
| `body_type`       | string | Classification label               | Star, Planet, Moon, DwarfPlanet |

All 11 feature columns are used by the model. Target column: `body_type`.

## Data Cleaning Notes

- Missing values are filled with 0 during training
- All masses use Earth mass ratios, distances in AU
