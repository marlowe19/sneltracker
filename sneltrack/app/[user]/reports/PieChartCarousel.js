"use client";

import { useState } from "react";
import Slider from "react-slick";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

export default function PieChartCarousel({ cards = [] }) {
  const [currentSlide, setCurrentSlide] = useState(0);

  if (cards.length === 0) {
    return null;
  }

  const settings = {
    dots: true,
    infinite: cards.length > 1,
    speed: 300,
    slidesToShow: 1,
    slidesToScroll: 1,
    swipe: true,
    draggable: true,
    arrows: false,
    adaptiveHeight: false,
    beforeChange: (current, next) => setCurrentSlide(next),
    customPaging: (i) => (
      <div
        className={`w-2 h-2 rounded-full transition-all ${
          i === currentSlide ? "bg-[#008eff]" : "bg-gray-300 hover:bg-gray-400"
        }`}
      />
    ),
  };

  return (
    <div className="mb-6">
      <div className="px-4">
        <div style={{ height: "480px" }}>
          <Slider {...settings}>
            {cards.map((card) => (
              <div key={card.id}>
                <div
                  className="bg-white rounded-xl p-4 shadow-md select-text h-full mx-4"
                  style={{ height: "480px" }}
                >
                  <div className="text-sm text-gray-600 mb-3 font-medium text-center">
                    {card.title}
                  </div>
                  <div style={{ height: "calc(100% - 2rem)" }}>
                    {card.content}
                  </div>
                </div>
              </div>
            ))}
          </Slider>
        </div>
      </div>
    </div>
  );
}
