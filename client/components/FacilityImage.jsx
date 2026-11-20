import React, { useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';

export function FacilityImage({ src, alt, className = 'facility-media-img' }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div className="facility-media-fallback" role="img" aria-label={alt}>
        <Building2 size={28} aria-hidden="true" />
        <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      referrerPolicy="no-referrer"
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
