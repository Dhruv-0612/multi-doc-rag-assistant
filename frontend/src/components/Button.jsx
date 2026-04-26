function Button({ children, onClick }) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition"
    >
      {children}
    </button>
  );
}

export default Button;
