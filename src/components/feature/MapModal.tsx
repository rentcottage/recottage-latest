import { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { resolveCoords, spread, ringOffset, type CoordSource } from '../../lib/geocode';
import { useT } from '../../i18n';

export interface MapListing {
  id: string;
  title: string;
  location: string;
  price: number;
  rating: number;
  reviews: number;
  image?: string;
  images?: string[];
  latitude?: number | null;
  longitude?: number | null;
}

interface Props {
  listings: MapListing[];
  onClose: () => void;
}

/** Brand pin — a div icon, so no marker image assets need bundling. */
const pinIcon = (approx: boolean) =>
  L.divIcon({
    className: '',
    html: `<div style="
      width:26px;height:26px;border-radius:50% 50% 50% 0;
      background:#fb2c36;transform:rotate(-45deg);
      border:2.5px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);
      ${approx ? 'opacity:.75;' : ''}
    "></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
    popupAnchor: [0, -26],
  });

export default function MapModal({ listings, onClose }: Props) {
  const { t } = useT();
  const navigate = useNavigate();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  // Resolve every listing to a point (exact where the data has one).
  const points = useMemo(() => {
    const resolved = listings
      .map((l) => {
        const c = resolveCoords(l.location, l.latitude, l.longitude);
        return c ? { listing: l, ...c } : null;
      })
      .filter(Boolean) as { listing: MapListing; lat: number; lng: number; source: CoordSource }[];

    // Fan out listings sharing a town centre so their pins stay clickable.
    const idx = spread(resolved, (r) => `${r.lat},${r.lng}`);
    return resolved.map((r) => {
      const [dLat, dLng] = r.source === 'approximate' ? ringOffset(idx.get(r) ?? -1) : [0, 0];
      return { ...r, lat: r.lat + dLat, lng: r.lng + dLng };
    });
  }, [listings]);

  const unmappable = listings.length - points.length;
  const approxCount = points.filter((p) => p.source === 'approximate').length;

  useEffect(() => {
    if (!hostRef.current || mapRef.current) return;

    const map = L.map(hostRef.current, { scrollWheelZoom: true }).setView([42.0, 43.5], 7);
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(map);

    const markers: L.Marker[] = [];
    points.forEach((p) => {
      const l = p.listing;
      const photo = l.image || l.images?.[0] || '';
      const detailUrl = `/property/${l.id}`;
      const html = `
        <div style="width:210px;font-family:inherit">
          ${photo ? `<img src="${photo}" alt="" style="width:100%;height:110px;object-fit:cover;border-radius:10px;margin-bottom:8px" />` : ''}
          <div style="font-weight:700;font-size:14px;color:#222;line-height:1.3;margin-bottom:2px">${escapeHtml(l.title)}</div>
          <div style="font-size:12px;color:#6b7280;margin-bottom:6px">${escapeHtml(l.location)}</div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
            <span style="font-size:16px;font-weight:800;color:#222">₾${l.price}<span style="font-size:11px;font-weight:500;color:#6b7280"> / ${escapeHtml(t('search.perNight'))}</span></span>
            <span style="font-size:12px;font-weight:700;color:#fb2c36">★ ${l.rating}</span>
          </div>
          ${p.source === 'approximate' ? `<div style="font-size:10.5px;color:#9ca3af;margin-bottom:8px">${escapeHtml(t('search.mapApproxPin'))}</div>` : ''}
          <button data-detail="${detailUrl}" style="
            display:block;width:100%;background:#fb2c36;color:#fff;border:none;border-radius:10px;
            padding:8px 0;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">
            ${escapeHtml(t('search.mapViewCottage'))}
          </button>
        </div>`;

      const m = L.marker([p.lat, p.lng], { icon: pinIcon(p.source === 'approximate') })
        .addTo(map)
        .bindPopup(html, { maxWidth: 240 });
      markers.push(m);
    });

    if (markers.length) {
      map.fitBounds(L.featureGroup(markers).getBounds().pad(0.15));
    }

    // Popup buttons are raw HTML, so route clicks through the router.
    const onPopupClick = (e: Event) => {
      const target = (e.target as HTMLElement)?.closest('[data-detail]');
      if (!target) return;
      navigate(target.getAttribute('data-detail')!);
      onClose();
    };
    map.getContainer().addEventListener('click', onPopupClick);

    // Leaflet needs a size recalc once the modal has laid out.
    setTimeout(() => map.invalidateSize(), 50);

    return () => {
      map.getContainer().removeEventListener('click', onPopupClick);
      map.remove();
      mapRef.current = null;
    };
  }, [points, navigate, onClose, t]);

  // Esc closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[1000] bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white w-full max-w-[1100px] h-[80vh] rounded-card overflow-hidden shadow-card-hover flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-line flex-shrink-0">
          <div className="min-w-0">
            <h2 className="text-[17px] font-extrabold text-ink">{t('search.mapTitle')}</h2>
            <p className="text-xs text-soft mt-0.5">
              {t('search.mapPinCount', { count: String(points.length) })}
              {approxCount > 0 && <> · {t('search.mapApproxCount', { count: String(approxCount) })}</>}
              {unmappable > 0 && <> · {t('search.mapUnmapped', { count: String(unmappable) })}</>}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label={t('search.mapClose')}
            className="w-9 h-9 rounded-full border border-line flex items-center justify-center text-ink hover:bg-gray-50 cursor-pointer flex-shrink-0"
          >
            <i className="ri-close-line text-lg"></i>
          </button>
        </div>
        <div ref={hostRef} className="flex-1 min-h-0" />
      </div>
    </div>
  );
}

function escapeHtml(s: string) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string)
  );
}
