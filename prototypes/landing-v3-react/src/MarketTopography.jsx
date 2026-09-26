import React from "react";

export default function MarketTopography() {
  return (
    <div className="market-topography" aria-hidden="true">
      <img
        className="market-topography-field"
        src="/brand/market-topography-field.svg"
        alt=""
        draggable="false"
      />
      <span className="market-topography-bloom" />
      <span className="market-topography-graze" />
    </div>
  );
}
