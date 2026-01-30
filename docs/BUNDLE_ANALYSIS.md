# Bundle Analysis Report

## T100.1: Bundle Size Analysis

**Generated:** January 30, 2026  
**Tool:** rollup-plugin-visualizer  
**Command:** `ANALYZE=true npm run build`

---

## Summary

| Chunk | Size | Gzipped | Status |
|-------|------|---------|--------|
| `index.js` (main) | 2,074.78 KB | 452.24 KB | ⚠️ Large |
| `vendor-charts` (recharts) | 543.72 KB | 162.06 KB | ⚠️ Large |
| `vendor-firebase` | 522.16 KB | 119.40 KB | ⚠️ Large |
| `html2canvas` | 201.42 KB | 48.03 KB | Acceptable |
| `index.es` (pdfmake) | 150.62 KB | 51.52 KB | Acceptable |
| `vendor-utils` (zod, fuse.js) | 87.49 KB | 25.07 KB | ✅ Good |
| `vendor-lucide` | 29.62 KB | 7.34 KB | ✅ Good |
| `purify.es` (DOMPurify) | 22.64 KB | 8.75 KB | ✅ Good |
| `vendor-react` | 0.07 KB | 0.08 KB | ✅ Good |

**Total Initial Bundle:** ~2.1 MB (452 KB gzipped)

---

## Largest Dependencies

### 1. Recharts (543 KB)
**Location:** `vendor-charts`  
**Usage:** Dashboard charts, analytics visualizations

**Optimization Options:**
- [ ] Lazy load charts (only load when viewing dashboard)
- [ ] Consider lighter alternative (e.g., Chart.js, visx)
- [ ] Tree-shake unused chart types

### 2. Firebase (522 KB)
**Location:** `vendor-firebase`  
**Usage:** Auth fallback, Firestore (legacy)

**Optimization Options:**
- [ ] Remove after Railway migration complete
- [ ] Use modular imports only
- [ ] Expected savings: ~500 KB after Sprint 99

### 3. html2canvas (201 KB)
**Location:** Direct dependency  
**Usage:** PDF export, screenshot functionality

**Optimization Options:**
- [ ] Lazy load only when exporting
- [ ] Consider server-side PDF generation

### 4. Main App Bundle (2,074 KB)
**Location:** `index.js`  
**Usage:** Core application code

**Optimization Options:**
- [ ] Code split by route
- [ ] Lazy load modal components
- [ ] Tree-shake unused exports

---

## Code Splitting Configuration

Current manual chunks in `vite.config.ts`:

```typescript
manualChunks: {
  'vendor-react': ['react', 'react-dom'],
  'vendor-firebase': ['firebase/app', 'firebase/firestore', 'firebase/auth'],
  'vendor-charts': ['recharts'],
  'vendor-utils': ['zod', 'fuse.js'],
  'vendor-lucide': ['lucide-react'],
}
```

### Recommended Additions

```typescript
// Add route-based lazy loading
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Sequences = lazy(() => import('./pages/Sequences'));
const Analytics = lazy(() => import('./pages/Analytics'));

// Add heavy component lazy loading
const PDFExport = lazy(() => import('./components/PDFExport'));
const ChartComponents = lazy(() => import('./components/Charts'));
```

---

## Targets

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Initial JS (gzip) | 452 KB | < 300 KB | ❌ Over |
| Vendor chunks (gzip) | 320 KB | < 200 KB | ❌ Over |
| Main chunk (gzip) | 452 KB | < 150 KB | ❌ Over |
| LCP (Lighthouse) | TBD | < 2.5s | Pending |
| TTI (Lighthouse) | TBD | < 3.8s | Pending |

---

## Priority Optimization Tasks

### High Priority (Sprint 99 - Firebase Removal)
1. **Remove Firebase package** - Expected savings: ~500 KB (119 KB gzipped)
2. **Update vendor chunks** - Remove firebase from manualChunks

### Medium Priority (Post-Migration)
1. **Lazy load Recharts** - Only load on dashboard views
2. **Lazy load html2canvas** - Only load when exporting PDFs
3. **Route-based code splitting** - Split by major routes

### Low Priority (Future Optimization)
1. Consider lighter chart library
2. Server-side PDF generation
3. Image optimization (WebP)

---

## How to Regenerate

```bash
# Generate bundle analysis
ANALYZE=true npm run build

# View report
open dist/stats.html
```

---

## Related Files

- [vite.config.ts](../vite.config.ts) - Build configuration
- [dist/stats.html](../dist/stats.html) - Interactive treemap visualization
