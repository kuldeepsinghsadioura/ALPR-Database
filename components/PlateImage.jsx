import Image from "next/image";
import { useState } from "react";

export default function PlateImage({ plate, onClick, className }) {
  const [error, setError] = useState(false);

  const getImageUrl = () => {
    if (error || (!plate.image_path && !plate.image_data)) {
      return "/placeholder-image.jpg";
    }

    // backwards compatibility for old base64
    if (plate.image_data) {
      if (plate.image_data.startsWith("data:image/jpeg;base64,")) {
        return plate.image_data;
      }
      return `data:image/jpeg;base64,${plate.image_data}`;
    }

    // thumbnail path
    return `/api/images/${encodeURIComponent(plate.thumbnail_path)}`;
  };

  return (
    <Image
      src={getImageUrl()}
      alt={plate.plate_number}
      width={100}
      height={75}
      className={`rounded cursor-pointer ${className || ""}`}
      onClick={onClick}
      onError={() => setError(true)}
    />
  );
}
