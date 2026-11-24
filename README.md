# Urban Grievance

An anonymous, public platform where citizens report city and environmental problems
(potholes, water leakage, dirty water, garbage and more) with a live-camera photo and GPS.
Reports stay public until an official fixes them and proves it with a verified "after" photo.

**Live demo:** [paste your GitHub Pages link here]

## Features
- Camera-only reporting with GPS (no gallery uploads, to reduce fake reports)
- Anonymous reporters; duplicate reports within 50 m are merged ("Same issue?")
- Public map, feed and details pages, with likes/dislikes (one per device)
- Community photo flagging: photos are blurred after 3 reports (never deleted)
- Official accounts (local officer / higher authority) created by the administrator
- Officer dashboard: statistics, charts, task list, Google Maps navigation
- "After" photo with GPS check: a report is marked Solved only if the photo is taken at the original spot

## Tech stack
HTML, CSS, JavaScript, Supabase (database, storage, login), Leaflet + OpenStreetMap, Chart.js, GitHub Pages

## Demo official accounts (dummy data)
| Role | Email | Password |
|---|---|---|
| Local officer (roads) | roads.local@demo.test | Demo@12345 |
| Higher authority (roads) | roads.higher@demo.test | Demo@12345 |
| Local officer (water) | water.local@demo.test | Demo@12345 |

## Team
4-idiots

## Disclaimer
Citizen-reported, unverified information. This is a student prototype.
