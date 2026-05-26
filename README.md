# SPMB SMAN 1 Samarinda 2026/2027

Landing page statis berbasis Vite untuk informasi SPMB.

## Menjalankan lokal

```bash
npm install
npm run dev
```

## Build produksi

```bash
npm run build
```

Output build ada di folder `dist/`.

## Deploy ke GitHub Pages

1. Pastikan **Settings → Pages → Source** diset ke **GitHub Actions**.
2. Workflow akan otomatis build & deploy saat ada push ke branch `main`.
3. Bisa jalankan manual dari tab **Actions** lewat workflow `Deploy to GitHub Pages`.

Jika tampilan tanpa CSS, pastikan Pages mengambil hasil build `dist/` (bukan file HTML mentah di root).
