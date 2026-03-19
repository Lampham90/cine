import React, { useEffect, useState, useCallback, useRef, memo } from 'react';
import axios from 'axios';

// [HIỆU ỨNG HOVER SPOTLIGHT & TẬP MỜ HIỂN THỊ]
const MovieCard = memo(({ movie, onClick, isRecent = false }) => {
  const getEpDisplay = () => {
    if (isRecent) {
      return `ĐANG XEM: TẬP ${movie.lastEp?.toString().replace(/Tập\s*/i, '').toUpperCase() || '1'}`;
    }
    const rawEp = movie.episode_current || movie.last_episode || "HD";
    return `TẬP ${rawEp.toString().replace(/Tập\s*/i, '').toUpperCase()}`;
  };

  return (
    <div onClick={() => onClick(movie.slug)} className="group cursor-pointer relative animate-in fade-in zoom-in duration-500">
      <div className="relative rounded-xl overflow-hidden bg-zinc-900 border border-white/5 transition-all duration-700 group-hover:scale-110 group-hover:rotate-[-2deg] group-hover:border-white/20 group-hover:shadow-[0_20px_60px_rgba(0,0,0,0.8),0_0_20px_rgba(255,255,255,0.05)]">
        
        {/* Tia sáng lướt qua khi hover */}
        <div className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/10 to-transparent z-10" />

        {/* Label VIETSUB mờ */}
        <div className="absolute top-2 left-2 z-20">
          <span className="bg-black/40 backdrop-blur-md border border-white/10 text-white text-[9px] font-black px-2 py-1 rounded uppercase tracking-tighter shadow-xl">
            {movie.lang || 'VIETSUB'}
          </span>
        </div>
        
        <img 
          src={movie.poster_url?.startsWith('http') ? movie.poster_url : `https://phimimg.com/${movie.poster_url}`} 
          loading="lazy" 
          className="w-full aspect-[2/3] object-cover transition duration-700 group-hover:brightness-125" 
          alt={movie.name} 
        />

        {/* [TẬP MỜ HIỂN THỊ SẴN] */}
        <div className="absolute bottom-2 right-2 z-20">
          <span className="bg-black/40 backdrop-blur-md border border-white/10 text-gray-100 text-[10px] font-black px-2.5 py-1.5 rounded-lg shadow-xl leading-none">
            {getEpDisplay()}
          </span>
        </div>
      </div>

      <div className="mt-3 px-1 transition-transform duration-500 group-hover:translate-x-1">
        <h4 className="text-[12px] font-black uppercase truncate text-gray-100 group-hover:text-red-600 transition-colors leading-tight">
          {movie.name}
        </h4>
        <p className="text-[13px] font-bold text-gray-600 mt-1 flex items-center gap-1.5">
          {movie.year} <span className="text-[11px] opacity-0 group-hover:opacity-100 transition-opacity">🍿</span>
        </p>
      </div>
    </div>
  );
});

function App() {
  const [sections, setSections] = useState({ hot: [], anime: [], hhtq: [], cine: [], korea: [], china: [], search: [] });
  const [recent, setRecent] = useState([]);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [playerUrl, setPlayerUrl] = useState('');
  const [activeServer, setActiveServer] = useState(0);
  const [activeEp, setActiveEp] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('home');
  const [currentBanner, setCurrentBanner] = useState(0); 
  const playerRef = useRef(null);

  const sortNewest = useCallback((list) => {
    return list ? [...list].sort((a, b) => (parseInt(b.year) || 0) - (parseInt(a.year) || 0)) : [];
  }, []);

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('lam_house_recent')) || [];
    setRecent(saved);
    const timer = setInterval(() => setCurrentBanner(p => (p + 1) % 5), 6000);
    return () => clearInterval(timer);
  }, []);

  const fetchData = useCallback(async (mode = 'home', page = 1, query = '') => {
    setViewMode(mode); 
    setCurrentPage(page);
    try {
      if (mode === 'home') {
        const [resHot, resAnime, resCine, resKorea, resChina] = await Promise.all([
          axios.get(`https://phimapi.com/danh-sach/phim-moi-cap-nhat?page=${page}`),
          axios.get(`https://phimapi.com/v1/api/danh-sach/hoat-hinh?limit=24&page=${page}`),
          axios.get(`https://phimapi.com/v1/api/danh-sach/phim-le?limit=24&page=${page}`),
          axios.get(`https://phimapi.com/v1/api/quoc-gia/han-quoc?limit=24&page=${page}`),
          axios.get(`https://phimapi.com/v1/api/quoc-gia/trung-quoc?limit=24&page=${page}`)
        ]);

        setSections({
          hot: sortNewest(resHot.data.items).slice(0, 8), 
          anime: sortNewest(resAnime.data.data.items.filter(i => !i.origin_name?.toLowerCase().includes('china'))).slice(0, 8),
          hhtq: sortNewest(resAnime.data.data.items.filter(i => i.origin_name?.toLowerCase().includes('china') || i.country?.some(c => c.slug === 'trung-quoc'))).slice(0, 8),
          cine: sortNewest(resCine.data.data.items).slice(0, 8),
          korea: sortNewest(resKorea.data.data.items).slice(0, 8),
          china: sortNewest(resChina.data.data.items).slice(0, 8),
          search: []
        });
      } else if (mode === 'search') {
        const res = await axios.get(`https://phimapi.com/v1/api/tim-kiem?keyword=${query}&limit=32`);
        setSections(prev => ({ ...prev, search: sortNewest(res.data.data.items) }));
      }
    } catch (err) { console.error("Lỗi API:", err); }
  }, [sortNewest]);

  useEffect(() => { fetchData('home', 1); }, [fetchData]);

  const handleWatch = async (slug, epIndex = 0) => {
    try {
      const res = await axios.get(`https://phimapi.com/phim/${slug}`);
      const { movie, episodes: eps } = res.data;
      setSelectedMovie(movie); 
      setEpisodes(eps);
      setPlayerUrl(eps[activeServer]?.server_data[epIndex].link_embed);
      setActiveEp(epIndex);
      setTimeout(() => playerRef.current?.scrollIntoView({ behavior: 'smooth' }), 300);
    } catch (err) { console.error(err); }
  };

  return (
    <div className="w-full min-h-screen bg-[#050505] text-white font-sans pb-20 overflow-x-hidden">
      <nav className="fixed top-0 w-full z-[100] px-6 md:px-12 py-5 flex justify-between items-center bg-black/80 backdrop-blur-2xl border-b border-white/5 shadow-2xl">
        <h1 className="text-red-600 text-3xl font-black tracking-tighter cursor-pointer active:scale-95 transition-transform" 
            onClick={() => { fetchData('home', 1); setSelectedMovie(null); }}>LÂM'S HOUSE</h1>
        <form onSubmit={(e) => { e.preventDefault(); fetchData('search', 1, searchQuery); setSelectedMovie(null); }}>
          <input 
            type="text" 
            placeholder="TÌM PHIM NGAY..." 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            className="bg-white/5 border border-white/10 rounded-full px-8 py-3 text-[13px] font-bold w-64 md:w-[400px] focus:border-red-600 outline-none transition-all shadow-inner placeholder:text-gray-600 uppercase" 
          />
        </form>
      </nav>

      <div className="pt-28">
        {/* BANNER 85VH CINEMATIC */}
        {viewMode === 'home' && !selectedMovie && sections.hot.length > 0 && (
          <div className="px-6 md:px-12 mb-16 animate-in fade-in duration-1000">
            <div className="relative w-full h-[85vh] rounded-[3rem] overflow-hidden border border-white/10 shadow-[0_0_60px_rgba(0,0,0,0.8)] bg-zinc-950">
              {sections.hot.slice(0, 5).map((movie, index) => (
                <div key={movie.slug} className={`absolute inset-0 transition-opacity duration-[1500ms] ease-in-out ${currentBanner === index ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}>
                  <img src={movie.thumb_url} className="w-full h-full object-cover brightness-100" alt="" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
                  
                  {/* CỤM GIỮA BANNER: Tên phim trên nút */}
                  <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-6 animate-in slide-in-from-bottom-5 duration-700">
                    <div className="bg-black/20 backdrop-blur-lg border border-white/5 px-6 py-3 rounded-2xl shadow-inner max-w-xl transition-all duration-700">
                      <h2 className="text-xl md:text-2xl font-black uppercase italic opacity-60 tracking-tighter leading-none text-center">{movie.name}</h2>
                    </div>
                    <button onClick={() => handleWatch(movie.slug)} className="bg-white/10 backdrop-blur-md border border-white/20 text-white px-12 py-4 rounded-2xl font-black uppercase text-[11px] hover:bg-red-600 hover:scale-110 hover:border-transparent transition-all shadow-2xl active:scale-95">
                      Xem ngay
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {selectedMovie && (
          <div ref={playerRef} className="w-full mb-16 px-4 md:px-0 animate-in fade-in duration-700">
            <div className="max-w-[1400px] mx-auto rounded-[2rem] shadow-2xl border border-white/5 aspect-video bg-black overflow-hidden relative">
               <iframe src={playerUrl} className="w-full h-full border-none" allowFullScreen title="player" />
            </div>
            <div className="max-w-[1400px] mx-auto mt-10 p-8 bg-zinc-900/60 backdrop-blur-3xl rounded-[2.5rem] border border-white/5">
                <div className="flex flex-wrap gap-2 mb-8">
                    {episodes[activeServer]?.server_data.map((ep, i) => (
                      <button key={i} onClick={() => {setPlayerUrl(ep.link_embed); setActiveEp(i);}} 
                      className={`min-w-[60px] py-3 rounded-xl text-[12px] font-black transition-all ${activeEp === i ? 'bg-white text-black scale-110' : 'bg-white/5 hover:bg-white/10'}`}>{ep.name}</button>
                    ))}
                </div>
                <h2 className="text-3xl font-black uppercase text-red-600 italic tracking-tighter leading-none">{selectedMovie.name}</h2>
            </div>
          </div>
        )}

        <div className="space-y-20">
          <SectionRow title="Hot Trending" data={sections.hot} color="bg-red-600" MovieCard={MovieCard} onClick={handleWatch} />
          <SectionRow title="Anime Nhật Bản" data={sections.anime} color="bg-orange-400" MovieCard={MovieCard} onClick={handleWatch} />
          <SectionRow title="Cine Rạp" data={sections.cine} color="bg-purple-500" MovieCard={MovieCard} onClick={handleWatch} />
          <SectionRow title="Drama Hàn Quốc" data={sections.korea} color="bg-pink-500" MovieCard={MovieCard} onClick={handleWatch} />
          <SectionRow title="Drama Trung Quốc" data={sections.china} color="bg-cyan-500" MovieCard={MovieCard} onClick={handleWatch} />
        </div>
      </div>

      {/* PHÂN TRANG GỐC */}
      {viewMode === 'home' && (
        <div className="flex justify-center items-center gap-3 mt-24 pb-10 animate-in fade-in duration-1000">
          <button onClick={() => fetchData('home', Math.max(1, currentPage - 1))} className="p-4 bg-zinc-900 rounded-xl hover:text-red-500 transition-all active:scale-95">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
          </button>
          {[1, 2, 3, 4, 5].map(p => (
            <button key={p} onClick={() => fetchData('home', p)} 
            className={`w-14 h-14 rounded-xl font-black text-[15px] transition-all ${currentPage === p ? 'bg-red-600 scale-110 shadow-lg shadow-red-600/30 text-white' : 'bg-zinc-900 text-gray-500 hover:text-white'}`}>
              0{p}
            </button>
          ))}
          <button onClick={() => fetchData('home', currentPage + 1)} className="p-4 bg-zinc-900 rounded-xl hover:text-red-500 transition-all active:scale-95">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      )}
    </div>
  );
}

const SectionRow = memo(({ title, data, color, MovieCard, onClick, isRecent = false }) => (
  data.length > 0 && (
    <div className="px-6 md:px-12 animate-in slide-in-from-bottom-5 duration-500">
      <h3 className="text-2xl font-black italic flex items-center gap-3 mb-8 uppercase">
        <span className={`w-1.5 h-7 ${color} rounded-full`}></span> {title}
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-6">
        {data.map(m => <MovieCard key={m.slug + (isRecent ? '-rec' : '')} movie={m} onClick={onClick} isRecent={isRecent} />)}
      </div>
    </div>
  )
));

export default App;