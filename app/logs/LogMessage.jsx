const LogMessage = ({ log }) => {
  const getLogColor = (level) => {
    switch (level) {
      case "ERROR":
        return "text-[#F31260]";
      case "WARN":
        return "text-[#F5A524]";
      default:
        return "text-[#17C964]";
    }
  };

  return (
    <div className="py-1 font-mono text-sm">
      <span className="text-muted-foreground">
        {new Date(log.timestamp).toLocaleString()}
      </span>{" "}
      <span className={getLogColor(log.level)}>[{log.level}]</span>{" "}
      <span className="text-foreground">{log.message}</span>
    </div>
  );
};

export default LogMessage;
