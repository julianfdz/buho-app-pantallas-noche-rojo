// Motor nativo de Búho Noche. Proceso de larga vida: lee órdenes por stdin (una por línea) y responde
// una línea JSON por orden. Los eventos espontáneos salen como {"event":...}.
//   ping | monitores | color <normal|rojo|ambar> <brillo 1-100> | ddc <n> <vcp hex> <valor> | ddcget <n> <vcp hex>
//   apagar | despertar | salir
// El filtro de color (API de lupa de Windows) desaparece en cuanto el proceso muere: nada queda fijo en el sistema.
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

static class N {
  [DllImport("Magnification.dll")] public static extern bool MagInitialize();
  [DllImport("Magnification.dll")] public static extern bool MagUninitialize();
  [DllImport("Magnification.dll")] public static extern bool MagSetFullscreenColorEffect(float[] m);

  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)] public struct PM { public IntPtr h; [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)] public string d; }
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)] public struct MI { public int cb; public int l, t, r, b; public int wl, wt, wr, wb; public int f; [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string dev; }
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)] public struct DD { public int cb; [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string name; [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)] public string str; public int flags; [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)] public string id; [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)] public string key; }
  public delegate bool P(IntPtr m, IntPtr dc, IntPtr r, IntPtr d);
  [DllImport("user32")] public static extern bool EnumDisplayMonitors(IntPtr a, IntPtr b, P c, IntPtr d);
  [DllImport("user32", CharSet = CharSet.Unicode)] public static extern bool GetMonitorInfo(IntPtr m, ref MI i);
  [DllImport("user32", CharSet = CharSet.Unicode)] public static extern bool EnumDisplayDevices(string dev, int i, ref DD d, int f);
  [DllImport("dxva2")] public static extern bool GetNumberOfPhysicalMonitorsFromHMONITOR(IntPtr m, out uint n);
  [DllImport("dxva2")] public static extern bool GetPhysicalMonitorsFromHMONITOR(IntPtr m, uint n, [Out] PM[] a);
  [DllImport("dxva2")] public static extern bool DestroyPhysicalMonitors(uint n, PM[] a);
  [DllImport("dxva2")] public static extern bool GetVCPFeatureAndVCPFeatureReply(IntPtr h, byte c, IntPtr t, out uint cur, out uint max);
  [DllImport("dxva2")] public static extern bool SetVCPFeature(IntPtr h, byte c, uint v);

  [StructLayout(LayoutKind.Sequential)] public struct LII { public uint cb; public uint t; }
  [DllImport("user32")] public static extern bool GetLastInputInfo(ref LII i);
  [DllImport("user32")] public static extern IntPtr SendMessageTimeout(IntPtr h, uint msg, IntPtr w, IntPtr l, uint flags, uint to, out IntPtr res);
  [DllImport("user32")] public static extern void mouse_event(uint f, int x, int y, uint d, IntPtr e);
  [DllImport("kernel32")] public static extern uint SetThreadExecutionState(uint f);
}

class Mon { public int n; public string dev, nombre, id; public int w, h; public bool principal; public IntPtr ph; public bool ddc; public int brillo = -1, brilloMax = 100; public bool power; }

static class Program {
  static readonly object outLock = new object();
  static readonly List<Mon> mons = new List<Mon>();
  static volatile bool apagado = false;
  static uint inputAlApagar;
  static readonly Queue<float[]> colaLupa = new Queue<float[]>();
  static readonly AutoResetEvent hayLupa = new AutoResetEvent(false);
  static volatile bool lupaOk = false;

  static void Out(string s) { lock (outLock) { Console.Out.WriteLine(s); Console.Out.Flush(); } }
  static string Q(string s) {
    if (s == null) return "null";
    var b = new StringBuilder("\"");
    foreach (var c in s) { if (c == '"' || c == '\\') b.Append('\\').Append(c); else if (c < 32) b.Append(' '); else b.Append(c); }
    return b.Append('"').ToString();
  }
  static string B(bool v) { return v ? "true" : "false"; }

  static void Enumerar() {
    foreach (var m in mons) if (m.ph != IntPtr.Zero) { try { N.DestroyPhysicalMonitors(1, new[] { new N.PM { h = m.ph } }); } catch { } }
    mons.Clear();
    int n = 0;
    N.EnumDisplayMonitors(IntPtr.Zero, IntPtr.Zero, (hm, dc, r, d) => {
      var mi = new N.MI(); mi.cb = Marshal.SizeOf(mi); N.GetMonitorInfo(hm, ref mi);
      string nombre = null, id = null;
      var dd = new N.DD(); dd.cb = Marshal.SizeOf(dd);
      if (N.EnumDisplayDevices(mi.dev, 0, ref dd, 1)) { nombre = dd.str; id = dd.id; }
      uint c; N.GetNumberOfPhysicalMonitorsFromHMONITOR(hm, out c);
      var a = new N.PM[Math.Max(c, 1)];
      if (c > 0) N.GetPhysicalMonitorsFromHMONITOR(hm, c, a);
      for (int i = 0; i < Math.Max(c, 1); i++) {
        var m = new Mon { n = n++, dev = mi.dev, nombre = nombre, id = id, w = mi.r - mi.l, h = mi.b - mi.t, principal = (mi.f & 1) == 1, ph = c > 0 ? a[i].h : IntPtr.Zero };
        uint cur, max;
        if (m.ph != IntPtr.Zero && N.GetVCPFeatureAndVCPFeatureReply(m.ph, 0x10, IntPtr.Zero, out cur, out max)) { m.ddc = true; m.brillo = (int)cur; m.brilloMax = (int)Math.Max(max, 1); }
        if (m.ddc && N.GetVCPFeatureAndVCPFeatureReply(m.ph, 0xD6, IntPtr.Zero, out cur, out max)) m.power = true;
        mons.Add(m);
      }
      return true;
    }, IntPtr.Zero);
  }

  static string MonsJson() {
    var b = new StringBuilder("[");
    foreach (var m in mons) {
      if (b.Length > 1) b.Append(',');
      b.Append("{\"n\":" + m.n + ",\"dev\":" + Q(m.dev) + ",\"nombre\":" + Q(m.nombre) + ",\"id\":" + Q(m.id)
        + ",\"ancho\":" + m.w + ",\"alto\":" + m.h + ",\"principal\":" + B(m.principal) + ",\"ddc\":" + B(m.ddc)
        + ",\"brillo\":" + m.brillo + ",\"brilloMax\":" + m.brilloMax + ",\"apagable\":" + B(m.power) + "}");
    }
    return b.Append(']').ToString();
  }

  // Matriz 5x5 fila a fila: fila = canal de entrada (R,G,B,A,1), columna = canal de salida.
  static float[] Matriz(string modo, float k) {
    var m = new float[25];
    m[18] = 1f; m[24] = 1f;
    if (modo == "rojo" || modo == "ambar") {
      // La luminancia de la imagen pasa al canal rojo, con algo de ganancia para que el texto se lea.
      float wr = 0.45f, wg = 0.80f, wb = 0.25f;
      m[0] = wr * k; m[5] = wg * k; m[10] = wb * k;
      if (modo == "ambar") { const float g = 0.30f; m[1] = wr * k * g; m[6] = wg * k * g; m[11] = wb * k * g; }
    } else { m[0] = k; m[6] = k; m[12] = k; }
    return m;
  }

  // La API de lupa exige que todo se haga desde el mismo hilo.
  static void BucleLupa() {
    lupaOk = N.MagInitialize();
    while (true) {
      hayLupa.WaitOne();
      float[] m = null;
      lock (colaLupa) { while (colaLupa.Count > 0) m = colaLupa.Dequeue(); }
      if (m == null) continue;
      if (m.Length == 0) { N.MagUninitialize(); return; }
      N.MagSetFullscreenColorEffect(m);
    }
  }
  static void Lupa(float[] m) { lock (colaLupa) colaLupa.Enqueue(m); hayLupa.Set(); }

  static uint UltimoInput() { var i = new N.LII(); i.cb = (uint)Marshal.SizeOf(i); N.GetLastInputInfo(ref i); return i.t; }
  static void Senal(int estado) { IntPtr r; N.SendMessageTimeout((IntPtr)0xFFFF, 0x0112, (IntPtr)0xF170, (IntPtr)estado, 0x0002, 2000, out r); }

  static void Apagar(int espera) {
    if (apagado) return;
    Thread.Sleep(espera); // margen para soltar el ratón tras el clic
    // Solo se corta la señal (apagado de Windows). El apagado por DDC (VCP D6=4) dejó el LG 24UD58 colgado
    // el 10/11/2026: no volvía ni con D6=1, había que pulsar su botón. No usarlo.
    Senal(2);
    Thread.Sleep(800);
    inputAlApagar = UltimoInput();
    apagado = true;
    Out("{\"event\":\"apagado\"}");
    new Thread(() => {
      int vuelta = 0;
      while (apagado) {
        Thread.Sleep(150);
        if (UltimoInput() != inputAlApagar) { Despertar("raton"); break; }
        // Si Windows vuelve a encender la señal por su cuenta, se reapaga cada 30 s.
        if (++vuelta % 200 == 0) Senal(2);
      }
    }) { IsBackground = true }.Start();
  }

  static void Despertar(string porque) {
    if (!apagado) return;
    apagado = false;
    Senal(-1);
    N.mouse_event(0x0001, 0, 1, 0, IntPtr.Zero); N.mouse_event(0x0001, 0, -1, 0, IntPtr.Zero);
    N.SetThreadExecutionState(0x00000002);
    Out("{\"event\":\"despierto\",\"por\":" + Q(porque) + "}");
  }

  static void Main() {
    // winexe sin consola: se usan los flujos estándar a mano (fijar Console.OutputEncoding falla sin consola).
    var salida = new System.IO.StreamWriter(Console.OpenStandardOutput(), new UTF8Encoding(false)) { AutoFlush = true };
    Console.SetOut(salida);
    Console.SetIn(new System.IO.StreamReader(Console.OpenStandardInput(), new UTF8Encoding(false)));
    var hilo = new Thread(BucleLupa) { IsBackground = true };
    hilo.SetApartmentState(ApartmentState.STA);
    hilo.Start();
    Enumerar();
    Out("{\"event\":\"listo\",\"monitores\":" + MonsJson() + "}");
    string linea;
    while ((linea = Console.In.ReadLine()) != null) {
      var p = linea.Trim().Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
      if (p.Length == 0) continue;
      try {
        switch (p[0]) {
          case "ping": Out("{\"ok\":true,\"apagado\":" + B(apagado) + ",\"lupa\":" + B(lupaOk) + "}"); break;
          case "monitores": Enumerar(); Out("{\"ok\":true,\"monitores\":" + MonsJson() + "}"); break;
          case "color": {
            string modo = p.Length > 1 ? p[1] : "normal";
            float k = p.Length > 2 ? float.Parse(p[2], CultureInfo.InvariantCulture) / 100f : 1f;
            Lupa(Matriz(modo, Math.Max(0.01f, Math.Min(1f, k))));
            Out("{\"ok\":true}"); break; }
          case "ddc": {
            var m = mons[int.Parse(p[1])]; byte vcp = Convert.ToByte(p[2], 16); uint v = uint.Parse(p[3]);
            bool ok = m.ddc && N.SetVCPFeature(m.ph, vcp, v);
            if (ok && vcp == 0x10) m.brillo = (int)v;
            Out("{\"ok\":" + B(ok) + "}"); break; }
          case "ddcget": {
            var m = mons[int.Parse(p[1])]; byte vcp = Convert.ToByte(p[2], 16); uint cur = 0, max = 0;
            bool ok = m.ddc && N.GetVCPFeatureAndVCPFeatureReply(m.ph, vcp, IntPtr.Zero, out cur, out max);
            Out("{\"ok\":" + B(ok) + ",\"valor\":" + cur + ",\"max\":" + max + "}"); break; }
          case "apagar": {
            int espera = p.Length > 1 ? int.Parse(p[1]) : 700;
            Out("{\"ok\":true}");
            new Thread(() => Apagar(espera)) { IsBackground = true }.Start(); break; }
          case "despertar": Despertar("orden"); Out("{\"ok\":true}"); break;
          case "salir": Despertar("salir"); Lupa(new float[0]); Thread.Sleep(200); Out("{\"ok\":true}"); return;
          default: Out("{\"ok\":false,\"error\":" + Q("Orden desconocida: " + p[0]) + "}"); break;
        }
      } catch (Exception e) { Out("{\"ok\":false,\"error\":" + Q(e.Message) + "}"); }
    }
    // stdin cerrado (la app se ha cerrado o ha caído): encender pantallas, quitar el filtro y salir.
    Despertar("cierre");
    Lupa(new float[0]); Thread.Sleep(200);
  }
}
