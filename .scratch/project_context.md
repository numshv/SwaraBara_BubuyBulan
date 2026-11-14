# Project Context: Indonesian Wildfire Data Sonification

> Briefing for another LLM picking up this project. Written in English. The user communicates in casual Indonesian.

## 1. Goal

The user is building a **data sonification of wildfires in Indonesia, year to year**, using **Indonesian traditional instruments** (gamelan etc.). Only data covering Indonesia is used. Current work is on **data sourcing, EDA and preprocessing into CSVs**. Sound mapping and composition have **not started** yet.

Working environment: **Kaggle notebooks** (Python). Data is uploaded to Kaggle datasets or downloaded inside the notebook.

## 2. Features

1. Play the sonification that has been made
2. INdonesia map data visualization. the  visualized data only the viirs fire spot as the time goes by, though the audio of the sonification includes other data such as CO, aerosol, etc (still hasn't fixly chosen)
3. When the song plays, once in a while there will be a naration in speech and text wise
4. there will be on off toggle for each data attributes shows on the music
5. each island can be clicked then it can play its own sonification of forest fire and visualization
6. for how each fire spot shows as the time pass by, it's shown as like how it's in map-and-fire-styling-vibe.png so it's a circle, the color take the last variation in the image, and the size of the circle and intensity of the color will be determined off of the data of each fire spot. The styling of the map is also used that vibe where it has tons of lines here and there and map is 2d drawn
7. it is imperative for the web is blind people friendly so it's accessible, you can do some grilling how it could serve the accesibility 
8. there would be a counter of some data (the plan will be ISPA patients as the time pass by and the amount of corrupted land) then when the song ends, it move to the center of the screen to emphasize the impact of the forest fire
9. when first accessing the web, the user will goes on some page onboarding. like this button is for what and you can do what. it's also happen when the music is about to start (because there will be a lot new options and data to see unlock in this state of the web). if there would be need some different treatment for the blind and the normal, maybe you can differentiate the user at the start of accessing the web, you could grill with me as to how to do this

## 3. VIIRS active fire detections (NASA FIRMS): the "fire events" layer
Source: NASA FIRMS country yearly summary CSVs (https://firms.modaps.eosdis.nasa.gov/country/), Indonesia.
Satellite: NOAA-20 only (satellite == "N20"). Do not mix satellites (S-NPP / NOAA-20 / NOAA-21), because detection counts jump when satellites change.
Years: 2018–2025 (user's Kaggle dataset). Caveat: the NOAA-20 archive is believed to be complete only from 2020, so 2018–2019 may be partial years. The notebook flags this; check before comparing years.
Format: tabular CSV, one row = one 375 m pixel flagged as fire in one satellite overpass (~2 passes/day, around 01:30 and 13:30 local). Not a "fire event"; large fires = many adjacent rows.
Raw columns: latitude, longitude, bright_ti4, scan, track, acq_date, acq_time, satellite, instrument, confidence, version, bright_ti5, frp, daynight, type
bright_ti4: brightness temp (K), I-4 band (~3.7 µm), fire-sensitive, saturates ~367 K
bright_ti5: brightness temp (K), I-5 band (~11.5 µm), background reference
scan, track: real pixel size in km (larger at swath edge); scan × track = pixel footprint km²
frp: Fire Radiative Power (MW), the best intensity metric (wide range, no saturation); heavily right-skewed
confidence: l / n / h
type: 0 vegetation fire, 1 volcano, 2 static land source/industrial, 3 offshore (archive data only)
acq_time: UTC, HHMM string (keep leading zeros)
