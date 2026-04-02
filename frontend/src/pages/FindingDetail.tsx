import { useParams } from "react-router-dom";

export default function FindingDetail() {
  const { id } = useParams<{ id: string }>();
  return <div className="p-6"><h1 className="text-2xl font-bold">Finding {id}</h1></div>;
}
