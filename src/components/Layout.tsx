import React from "react";
import { Link, useLocation } from "react-router-dom";

const sidebarLinks = [
  { label: "Dashboard", to: "/" },
  { label: "Support", to: "/support" },
];

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="fixed top-0 left-0 h-screen w-64 bg-black text-white flex flex-col py-6 px-4">
        <div className="mb-8 flex items-center justify-center">
          <span className="text-2xl font-bold tracking-wide">
            sayy <span className="text-blue-400">AI</span>
          </span>
        </div>
        <nav className="flex-1 space-y-2">
          {sidebarLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`block rounded px-4 py-2 text-base font-medium transition-colors ${
                location.pathname === link.to
                  ? "bg-blue-100 text-blue-700"
                  : "text-white hover:bg-gray-800"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </aside>
      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto ml-64">{children}</main>
    </div>
  );
};

export default Layout;
