# Data Format

Understanding the celestial datasets provided by SpaceAI.

## Dataset Structure

All datasets are CSV files with a consistent format.

## Celestial Objects (`celestial_objects.csv`)

The primary training dataset used by the classifier:

| Column | Type | Description | Examples |
|--------|------|-------------|----------|
| `orbital_period` | float | Days to complete one orbit | 88, 365.25, 4333 |
| `axial_tilt` | float | Tilt angle in degrees | 23.44, 97.77, 0.034 |
| `mass` | float | Mass relative to Earth (M🜨) | 1.0, 317.8, 0.055 |
| `type` | string | Classification label | Planet, Moon, Asteroid, DwarfPlanet, Comet |

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

- Missing values are marked as `NaN`
- All distances use astronomical units (AU, light years)
- All masses use Earth mass or solar mass ratios
