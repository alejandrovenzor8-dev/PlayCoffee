// Temporary toast implementation
export const toast = ({ title, description, variant }: { title: string; description: string; variant?: "default" | "destructive" }) => {
  console.log(`Toast [${variant || "default"}]: ${title} - ${description}`);
  
  // Simple browser alert for now
  if (typeof window !== "undefined") {
    const message = `${title}\n${description}`;
    if (variant === "destructive") {
      console.error(message);
    } else {
      console.log(message);
    }
  }
};
