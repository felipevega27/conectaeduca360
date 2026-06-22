export default function UserAvatar({ nombre, avatarUrl, className }) {
  const iniciales = nombre ? nombre.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : '??';

  return (
    <div className={`relative flex items-center justify-center shrink-0 overflow-hidden rounded-full ${className}`}>
      {avatarUrl ? (
        <img src={avatarUrl} alt={`Avatar de ${nombre}`} className="w-full h-full object-cover" />
      ) : (
        <span className="w-full h-full flex items-center justify-center">{iniciales}</span>
      )}
    </div>
  );
}
