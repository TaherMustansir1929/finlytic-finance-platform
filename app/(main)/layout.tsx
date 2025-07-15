const MainLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="container mx-auto my-32">
      <main>{children}</main>
    </div>
  )
}
export default MainLayout