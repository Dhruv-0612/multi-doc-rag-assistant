function SectionHeading({ title, subtitle }) {
  return (
    <div className="text-center mb-6">
      <h2 className="text-2xl font-semibold mb-2">{title}</h2>
      {subtitle && <p className="text-gray-400 text-sm">{subtitle}</p>}
    </div>
  );
}

export default SectionHeading;
