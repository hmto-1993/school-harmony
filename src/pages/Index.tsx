import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

// الصفحة الرئيسية تحول إلى لوحة التحكم أو تسجيل الدخول
const Index = () => {
  const { user, loading } = useAuth();
  
  if (loading) return null;
  
  return user ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />;
};

export default Index;
