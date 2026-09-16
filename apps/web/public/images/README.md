# Card photography

Every card on the home page reads its picture from
`apps/web/content/imagery.ts`. Put the file here, fill in that card's `image`
block, and the card switches from its drawing to the photograph on the next
build. No component changes.

## Why the drawings are there

The photographs could not be fetched from the environment this was built in:
the egress proxy answers `403` to `CONNECT` for every image host — Unsplash,
Pexels, Wikimedia Commons. Each card therefore carries a hand-drawn motif and
the exact search query for the photograph that should replace it.

The drawings are a fallback, not the design. They should not survive contact
with real photography.

## Filenames

One file per card, named after its `key`. `.jpg` unless the image genuinely
needs transparency — Next generates WebP and AVIF from whatever is here.

| File | Card | Search for |
| --- | --- | --- |
| `wedding.jpg` | Weddings | South Asian Indian wedding mandap ceremony bride and groom |
| `religious.jpg` | Pujas & ceremonies | Hindu griha pravesh puja ceremony kalash priest family |
| `milestone.jpg` | Family milestones | Indian half saree ceremony family celebration traditional attire |
| `festival.jpg` | Festival nights | Garba Navratri community celebration dandiya crowd dancing |
| `commercial.jpg` | Shoots & brand events | Indian boutique lookbook fashion photoshoot studio lighting |
| `makeup-artist.jpg` | Makeup artist | Indian bridal makeup artist applying makeup to South Asian bride |
| `photographer.jpg` | Photographer | Indian wedding photographer with camera shooting ceremony |
| `henna-artist.jpg` | Henna artist | henna artist applying intricate bridal mehndi to hands close up |
| `pandit.jpg` | Pandit | Hindu priest pandit performing puja ritual fire ceremony |
| `decorator.jpg` | Decorator | Indian wedding stage floral backdrop mandap decoration venue |
| `dj.jpg` | DJ | Indian wedding DJ sangeet reception dance floor event lighting |
| `videographer.jpg` | Videographer | wedding videographer filming Indian ceremony cinema camera |
| `caterer.jpg` | Caterer | Indian wedding catering buffet service thali food large event |

The queries are per card on purpose. One broad query — "Indian event" — returns
thirteen interchangeable pictures of marigolds, which is the failure this is
arranged to prevent.

## Sizes

Roughly 1600px on the long edge is plenty; `next/image` generates the smaller
widths from it. Anything much larger is bytes nobody downloads. Under about
1000px will look soft on a wide desktop card.

## Filling in the entry

```ts
image: {
  src: "/images/henna-artist.jpg",
  width: 1600,          // the file's real dimensions, not a guess
  height: 1067,
  alt: "A henna artist drawing a paisley pattern across a bride's palm",
  focal: "50% 40%",     // only when the subject is not centred
  credit: "Photographer name",
  licence: "Unsplash Licence",
  sourceUrl: "https://unsplash.com/photos/...",
},
```

`width` and `height` must be the file's true pixel dimensions. They reserve the
space before the image loads; wrong values make the page jump as it fills in.

`focal` is an `object-position`. Cards crop to a fixed ratio, so this is what
keeps the thing that communicates the service in frame — the hands in a mehndi
photograph, the decorated stage in a decorator's, the face in a makeup
artist's. Check every one; centre is the default and is wrong often.

## Licensing

Only use photographs there is a right to publish. Record the licence in the
entry rather than in someone's memory — `credit` and `licence` are required
fields for that reason.

Do not take images from other event companies' websites.

## Checking one

Hide the title and look only at the picture. If it does not say which service
it is, it is the wrong picture — a generic hall, a close-up of flowers, or a
stock model against a white background all fail that test. Then look at the
card at 375px and at 1440px: the subject must still be in frame at both, which
is what `focal` is for.
