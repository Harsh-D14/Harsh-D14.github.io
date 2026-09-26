# harsh-d14.github.io

Personal portfolio of Harshvardan S M, served by GitHub Pages at
https://harsh-d14.github.io.

## Structure

```
index.html              Home page
projects.html           Projects page, project data lives in its script
assets/images/          Site-wide images (profile photo, logos)
projects/<name>/        One folder per project
    thumbnail.jpg       Card image, required
    image1.jpg ...      Gallery images, listed in projects.html
```

## Adding a project

1. Create `projects/<name>/` using lowercase words joined by hyphens.
2. Add `thumbnail.jpg` and any gallery images.
3. Add an entry to the `projects` array in `projects.html`, with
   `folder: 'projects/<name>'` and the gallery file names in `images`.
   Optional links: `githubLink`, `articleLink`, `liveLink`.

## Running locally

```bash
python3 -m http.server 8000 --bind 127.0.0.1
```

Then open http://localhost:8000.
