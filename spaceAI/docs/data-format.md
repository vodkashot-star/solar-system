# Data Format

Understanding the celestial datasets provided by SpaceAI.

## Dataset Structure

All datasets are CSV files with a consistent format.

## Celestial Objects (`celestial_objects.csv`)

The primary training dataset used by the classifier:

| Column | Type | Description | Examples |
|--------|------|-------------|----------|
| `name` | string | Object name | Sun, Earth, Pluto |
| `orbital_period` | float | Days to complete one orbit | 88, 365.25, 4333 |
| `axial_tilt` | float | Tilt angle in degrees | 23.44, 97.77, 0.034 |
| `mass` | float | Mass relative to Earth | 1.0, 317.8, 0.055 |
| `radius` | float | Radius relative to Earth | 1.0, 11.209, 0.383 |
| `eccentricity` | float | Orbit shape (0=circle, <1=ellipse) | 0.017, 0.205, 0.0 |
| `body_type` | string | Classification label | Star, Planet, Moon, DwarfPlanet |

The 5 features used by the model: `orbital_period`, `axial_tilt`, `mass`, `radius`, `eccentricity`.

Target column: `body_type`.

## Reference Datasets

These are provided for educational exploration and future model development.

### Star Dataset (`stars.csv`)

| Column | Type | Description |
|--------|------|-------------|
| `spectral_type` | string | OBAFGKM classification |
| `temperature` | float | Surface temperature (K) |
| `luminosity` | float | Relative to Sun |
| `mass` | float | Solar masses |
| `radius` | float | Solar radii |
| `age` | float | Millions of years |

### Planet Dataset (`planets.csv`)

| Column | Type | Description |
|--------|------|-------------|
| `orbital_period` | float | Days to orbit star |
| `semi_major_axis` | float | AU from star |
| `eccentricity` | float | Orbit shape (0=circle) |
| `inclination` | float | Degrees from ecliptic |
| `mass` | float | Earth masses |
| `radius` | float | Earth radii |
| `axial_tilt` | float | Degrees |

### Galaxy Dataset (`galaxies.csv`)

| Column | Type | Description |
|--------|------|-------------|
| `galaxy_type` | string | Spiral, elliptical, irregular |
| `mass` | float | Solar masses |
| `diameter` | float | Light years |
| `redshift` | float | Velocity indicator |
| `star_rate` | float | New stars/year |

## Data Cleaning Notes

- Missing values are filled with 0 during training
- All distances use astronomical units (AU, light years)
- All masses use Earth mass or solar mass ratios
