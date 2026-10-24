import { useState } from "react";

function IdeaPhoto({ image, className }) {
  const [failed, setFailed] = useState(false);
  if (!image || failed) {
    return <div className={`${className} bg-[linear-gradient(165deg,#243352_0%,#10182a_70%)]`} />;
  }
  return (
    <img
      src={image}
      alt=""
      className={`${className} object-cover`}
      onError={() => setFailed(true)}
    />
  );
}

export function PlaceIdeas({ deck, onOpen }) {
  if (!deck) return null;
  if (deck.loading) {
    return (
      <p className="card mt-5 rounded-[1.4rem] px-4 py-4 text-sm text-[var(--muted)]">
        Finding places near {deck.place}…
      </p>
    );
  }
  if (!deck.cards?.length) return null;
  const [featured, ...rest] = deck.cards;
  return (
    <>
      <button
        type="button"
        className="card relative mt-5 w-full overflow-hidden rounded-[1.7rem] text-left"
        onClick={() => onOpen(featured.planLabel)}
      >
        <IdeaPhoto image={featured.image} className="h-48 w-full" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#070B14] via-[#070B14]/25 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-5">
          <p className="kicker">{deck.kicker}</p>
          <h2 className="serif mt-1 text-3xl font-semibold">{featured.name}</h2>
          <p className="mt-1 text-sm text-[#d8d2c6]">{featured.detail}</p>
        </div>
      </button>
      {rest.length > 0 && (
        <div className="no-scrollbar mt-3 flex gap-3 overflow-x-auto pb-1">
          {rest.map((place) => (
            <button
              key={place.id}
              type="button"
              className="card relative h-36 w-36 shrink-0 overflow-hidden rounded-[1.2rem] text-left"
              onClick={() => onOpen(place.planLabel)}
            >
              <IdeaPhoto image={place.image} className="h-full w-full" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#070B14] via-transparent to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-2.5">
                <p className="serif text-lg font-semibold leading-none">{place.name}</p>
                <p className="mt-1 text-[0.65rem] text-[#d0c9bc]">{place.meta}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
