import { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useT } from '../../i18n';
import { MAX_LATITUDE, MAX_LONGITUDE, formatCoord as fmt, parseCoord } from '../../lib/coords';

/**
 * A draggable map pin, for the one thing a host cannot type: where the cottage
 * actually is.
 *
 * WHY LEAFLET + OPENSTREETMAP. It is the only mature option that needs no API
 * key at all, so nothing secret can end up in the bundle and there is no
 * billing account behind the map. Leaflet is BSD-2-Clause; the tiles come from
 * openstreetmap.org under the OSM Foundation's tile usage policy, which allows
 * exactly this kind of low-volume use as long as the attribution below stays
 * visible. Google Maps and Mapbox both require a paid, bundled key and are
 * therefore not options here.
 *
 * WHERE IT OPENS. On the saved pin if there is one; otherwise on the listing's
 * town, looked up once through Nominatim (also keyless, also OSM); otherwise
 * on Georgia. The lookup is best effort and never blocks: if it is slow,
 * rate-limited or down, the map simply opens on the country and the host drags
 * from there.
 *
 * The pin is a divIcon rather than Leaflet's default marker because the
 * default one loads its image through a bundler-relative URL that breaks under
 * Vite. This one is CSS, so there is nothing to resolve.
 */

/** Roughly the centre of Georgia, and a zoom that shows the whole country. */
const GEORGIA_CENTER: [number, number] = [42.0, 43.5];
const GEORGIA_ZOOM = 7;
/** Close enough to place a building once we know the town. */
const TOWN_ZOOM = 13;
const PIN_ZOOM = 16;

/** Keyless OSM geocoder. Bounded to Georgia so "Oni" cannot land in Italy. */
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';

export interface MapPinPickerProps {
  /** Current latitude, as the form holds it (a string, possibly empty). */
  latitude: string;
  longitude: string;
  /** Called with fixed-precision strings, ready to store. */
  onChange: (lat: string, lng: string) => void;
  /** The listing's "City, Region" line, used only to choose the initial view. */
  locationHint?: string;
}


export default function MapPinPicker({ latitude, longitude, onChange, locationHint }: MapPinPickerProps) {
  const { t } = useT();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [locating, setLocating] = useState(false);

  const lat = parseCoord(latitude, MAX_LATITUDE);
  const lng = parseCoord(longitude, MAX_LONGITUDE);
  const hasPin = lat != null && lng != null;

  /** Drops or moves the pin, and reports the new position upwards. */
  const placePin = useCallback((position: L.LatLng, pan: boolean) => {
    const map = mapRef.current;
    if (!map) return;
    if (markerRef.current) {
      markerRef.current.setLatLng(position);
    } else {
      markerRef.current = L.marker(position, {
        draggable: true,
        // Styles are inline rather than in a stylesheet so this component is
        // self-contained: dropping it into another form needs no CSS import.
        icon: L.divIcon({
          className: '',
          html:
            '<div style="width:26px;height:26px;position:relative">' +
            '<div style="position:absolute;left:5px;top:0;width:16px;height:16px;' +
            'border-radius:50% 50% 50% 0;transform:rotate(-45deg);' +
            'background:#FB2C36;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>' +
            '<div style="position:absolute;left:11px;top:18px;width:4px;height:4px;' +
            'border-radius:50%;background:rgba(0,0,0,.35)"></div>' +
            '</div>',
          iconSize: [26, 26],
          iconAnchor: [13, 26],
        }),
      }).addTo(map);
      markerRef.current.on('dragend', () => {
        const p = markerRef.current!.getLatLng();
        onChange(fmt(p.lat), fmt(p.lng));
      });
    }
    if (pan) map.setView(position, Math.max(map.getZoom(), PIN_ZOOM));
    onChange(fmt(position.lat), fmt(position.lng));
  }, [onChange]);

  // Build the map once. Leaflet owns the DOM node from here on, so this must
  // not re-run: React would attach a second map to a container that has one.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: hasPin ? [lat, lng] : GEORGIA_CENTER,
      zoom: hasPin ? PIN_ZOOM : GEORGIA_ZOOM,
      scrollWheelZoom: false, // or the page cannot be scrolled past the map
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    // Clicking anywhere places the pin — dragging it is the fine adjustment.
    map.on('click', (e: L.LeafletMouseEvent) => placePin(e.latlng, false));
    mapRef.current = map;
    if (hasPin) placePin(L.latLng(lat, lng), false);

    // The map lives inside a modal that is still settling into its size on the
    // frame it mounts. Without this the tiles lay out against a container of
    // the wrong height and sit visibly offset until the first interaction.
    const resize = () => map.invalidateSize();
    const raf = requestAnimationFrame(resize);
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    if (observer && containerRef.current) observer.observe(containerRef.current);

    return () => {
      cancelAnimationFrame(raf);
      observer?.disconnect();
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // No pin yet: open on the town rather than on the whole country. Best effort.
  useEffect(() => {
    if (hasPin || !locationHint?.trim() || !mapRef.current) return;
    let cancelled = false;
    setLocating(true);
    const url = `${NOMINATIM}?format=json&limit=1&countrycodes=ge&q=${encodeURIComponent(locationHint.trim())}`;
    fetch(url, { headers: { Accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : null))
      .then((hits) => {
        if (cancelled || !mapRef.current || !Array.isArray(hits) || !hits[0]) return;
        const y = Number(hits[0].lat);
        const x = Number(hits[0].lon);
        if (Number.isFinite(y) && Number.isFinite(x)) mapRef.current.setView([y, x], TOWN_ZOOM);
      })
      .catch(() => { /* the country view is a perfectly good fallback */ })
      .finally(() => { if (!cancelled) setLocating(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The two text inputs stay editable, so a value typed there must move the pin.
  useEffect(() => {
    if (!mapRef.current || !hasPin) return;
    const current = markerRef.current?.getLatLng();
    if (current && Math.abs(current.lat - lat) < 1e-9 && Math.abs(current.lng - lng) < 1e-9) return;
    placePin(L.latLng(lat, lng), true);
  }, [lat, lng, hasPin, placePin]);

  const clear = () => {
    markerRef.current?.remove();
    markerRef.current = null;
    onChange('', '');
  };

  return (
    <div>
      <div
        ref={containerRef}
        className="h-64 w-full rounded-[10px] border border-line overflow-hidden z-0"
        role="application"
        aria-label={t('host.propertyEditModal.mapPickerLabel')}
      />
      <div className="flex items-center justify-between gap-3 mt-2 flex-wrap">
        <p className="text-xs text-soft">
          {locating
            ? t('common.loading')
            : hasPin
              // Shown as text so the host can sanity-check the pin against a
              // coordinate they trust before saving.
              ? `${fmt(lat)}, ${fmt(lng)}`
              : t('host.propertyEditModal.mapPickerHint')}
        </p>
        {hasPin && (
          <button
            type="button"
            onClick={clear}
            className="text-xs font-semibold text-red-500 hover:text-red-600 cursor-pointer"
          >
            {t('host.propertyEditModal.mapPickerClear')}
          </button>
        )}
      </div>
    </div>
  );
}
