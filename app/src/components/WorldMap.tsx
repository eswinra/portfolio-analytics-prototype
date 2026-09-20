import { BREAK_LABELS, mapAltText, mapModel, BADGE_R } from '../lib/geoMap';

/** The geographic exposure map.
 *
 *  It does not replace the table under it. Share of AUM is a quantity, and area is not a way to
 *  read a quantity: the United States at about 76% and Canada at about 2% occupy comparable parts
 *  of the page. The map answers the one question the table cannot — where in the world the named
 *  countries are — and the numbered badges tie the two together, so a reader who finds 7 on the
 *  map reads 7 in the list.
 *
 *  Everything the report does not name is drawn in one neutral fill with its own legend entry.
 *  Those countries are `missing`, not zero, and the page says so rather than letting pale grey be
 *  read as no exposure. */
export function WorldMap({
  top,
  fund,
  page,
}: {
  top: readonly (readonly [string, number, 'dm' | 'em'])[];
  fund: string;
  page: number;
}) {
  if (!top.length) return null;
  const model = mapModel(top);
  const alt = mapAltText(model, fund);
  const rest = model.shapes.length - model.badges.length;

  return (
    <figure className="wmap">
      <svg className="wmap-svg" viewBox={model.viewBox} role="img" aria-label={alt}>
        <title>{`Share of ${fund} AUM by country of domicile`}</title>
        <desc>{alt}</desc>
        {model.shapes.map((s) => (
          // no class at all for a country the report does not name, so `path[class]` means shaded
          <path key={s.c} d={s.d} className={s.band == null ? undefined : `b${s.band}`} />
        ))}
        {model.badges.map((b) => (
          <g key={b.code} className="wmap-bdg">
            <circle cx={b.x} cy={b.y} r={BADGE_R} />
            <text x={b.x} y={b.y + 3.6} textAnchor="middle">
              {b.rank}
            </text>
          </g>
        ))}
      </svg>
      <div className="wmap-leg">
        {BREAK_LABELS.map((label, i) => (
          <span key={label}>
            <i className={`b${i}`} />
            {label}
          </span>
        ))}
        <span>
          <i className="na" />
          not named in the report
        </span>
      </div>
      <figcaption>
        Numbers are the rank in the table below. Shaded by class, not a continuous scale, and area
        is not value — a large country with a small share covers more of the map than a small
        country with a larger one. The report names {model.badges.length + model.unplaced.length}{' '}
        countries; the other {rest} drawn here are not broken out, which is missing rather than
        zero. Source page {page}.
        {model.unplaced.length ? ` Not drawn: ${model.unplaced.join(', ')}.` : ''}
      </figcaption>
    </figure>
  );
}
