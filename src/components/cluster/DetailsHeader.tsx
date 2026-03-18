import { ArrowLeft, Server } from 'lucide-react';
import { useNavigate } from 'react-router-dom';


interface DetailsHeaderProps {
  name: string;
}

export function DetailsHeader({ name }: DetailsHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className="header-top">
      <button onClick={() => navigate(-1)} className="back-button">
        <ArrowLeft size={20} />
      </button>
      <div className="header-title-section">
        <h2>{name}</h2>
        <p>Cluster Detailed View</p>
      </div>
    </div>
  );
}
