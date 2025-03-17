import Image from "next/image";
import TPMSIcon from "/public/tpms.svg";

const TPMS = ({ size = 20 }) => {
  return (
    <div className="dark:invert">
      <Image src={TPMSIcon} width={size} height={size} alt="TPMS Icon" />
    </div>
  );
};

export default TPMS;
