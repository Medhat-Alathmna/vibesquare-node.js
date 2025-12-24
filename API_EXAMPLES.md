# Token Budget API Examples

## Endpoint
```
POST /api/analyze/url
```

---

## 1️⃣ Free User (مستخدم مجاني)
```json
{
  "url": "https://example.com",
  "tier": "free"
}
```

**Response includes:**
- Max 10 CSS classes
- Max 5 colors
- Max 5 images
- ~2000 tokens

---

## 2️⃣ Basic User
```json
{
  "url": "https://example.com",
  "tier": "basic",
  "model": "gemini-1.5-flash"
}
```

**Response includes:**
- Max 30 CSS classes
- Max 15 colors
- Max 15 images
- ~5000 tokens
- Full CSS details

---

## 3️⃣ Pro User
```json
{
  "url": "https://example.com",
  "tier": "pro",
  "model": "gpt-4o"
}
```

**Response includes:**
- Max 100 CSS classes
- Max 30 colors
- Max 30 images
- ~15000 tokens
- Full CSS details
- All metadata

---

## 4️⃣ Enterprise (No Limits)
```json
{
  "url": "https://example.com",
  "tier": "enterprise"
}
```

**Response includes:**
- Unlimited data
- ~50000 tokens
- Everything included

---

## 5️⃣ Custom Budget (مرن)
```json
{
  "url": "https://example.com",
  "customBudget": {
    "maxTokens": 8000,
    "maxCSSClasses": 50,
    "maxColors": 20,
    "maxImages": 25,
    "includeCSSDetails": true,
    "includeAllMetadata": false
  }
}
```

**Custom configuration for specific needs**

---

## 6️⃣ No Budget (Full Data)
```json
{
  "url": "https://example.com"
}
```

**Returns all data without limits**

---

## Response Structure

```json
{
  "statusCode": 200,
  "data": {
    "prompt": "...",
    "metadata": {
      "sourceUrl": "https://example.com",
      "sectionsFound": 12,
      "layoutType": "grid",
      "difficulty": "medium",
      "language": "en",
      "processingTimeMs": 2341
    },
    "debug": {
      "parsedDOM": {
        "sections": [...],
        "colors": [...],
        "cssInfo": {
          "classes": [
            {
              "className": "hero",
              "properties": {
                "background-color": "#000",
                "padding": "50px",
                "font-size": "24px"
              }
            }
          ],
          "gridColumns": 3,
          "breakpoints": ["768px", "1024px"]
        },
        "_metadata": {
          "tier": "free",
          "estimatedTokens": 1850,
          "wasReduced": true
        }
      }
    }
  },
  "message": "Analysis completed successfully"
}
```

---

## Available Tiers

| Tier | Max Tokens | Max CSS | Max Colors | Max Images | CSS Details | Full Metadata |
|------|-----------|---------|------------|------------|-------------|---------------|
| **free** | 2,000 | 10 | 5 | 5 | ❌ | ❌ |
| **basic** | 5,000 | 30 | 15 | 15 | ✅ | ❌ |
| **pro** | 15,000 | 100 | 30 | 30 | ✅ | ✅ |
| **enterprise** | 50,000 | ∞ | ∞ | ∞ | ✅ | ✅ |

---

## Use Cases

### Use Case 1: Dynamic Based on User Subscription
```javascript
// In your frontend or middleware
const userSubscription = user.subscription; // 'free' | 'basic' | 'pro'

fetch('/api/analyze/url', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: 'https://example.com',
    tier: userSubscription
  })
});
```

### Use Case 2: Custom Budget for Special Cases
```javascript
// For demo users - give them a taste of pro features
fetch('/api/analyze/url', {
  method: 'POST',
  body: JSON.stringify({
    url: 'https://example.com',
    customBudget: {
      maxTokens: 3000,
      maxCSSClasses: 20,
      includeCSSDetails: true
    }
  })
});
```

### Use Case 3: Check Token Count Before Sending to LLM
```javascript
const result = await fetch('/api/analyze/url', {
  method: 'POST',
  body: JSON.stringify({
    url: 'https://example.com',
    tier: 'basic'
  })
}).then(r => r.json());

const estimatedTokens = result.data.debug.parsedDOM._metadata?.estimatedTokens;
console.log(`Will use ~${estimatedTokens} tokens`);
```

---

## Error Responses

### Invalid Tier
```json
{
  "statusCode": 400,
  "message": "Tier must be one of: free, basic, pro, enterprise"
}
```

### Invalid Custom Budget
```json
{
  "statusCode": 400,
  "message": "maxTokens must be between 100 and 100000"
}
```

---

## Notes

- If neither `tier` nor `customBudget` is provided, full data is returned
- `customBudget` takes precedence over `tier` if both are provided
- Token estimation is approximate (1 token ≈ 4 characters)
- CSS classes are prioritized by number of properties
- Colors are prioritized by frequency
- Images with alt text are prioritized over those without
