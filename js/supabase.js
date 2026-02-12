// js/supabase.js

// 1. Configuración de Credenciales
// COPIA ESTO DE: Supabase Dashboard -> Settings -> API
const SUPABASE_URL = 'https://eyvvhvtfswpwgwirllaq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_iu1QQPGZW5yjmSErNAyh9Q_vsmKCdpj';

// 2. Inicializar el Cliente
// (La variable 'supabase' queda disponible para toda la app)
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Exportamos para usarlo en otros archivos si fuera módulos, 
// pero como usamos script tags clásicos, '_supabase' ya es global.
console.log("Supabase inicializado 🚀");