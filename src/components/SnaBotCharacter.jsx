import React from "react";

/**
 * SnaBotCharacter
 * High-fidelity, vector-based animated robot companion mascot.
 * Fully articulated with continuous kinematics: floating levitation,
 * natural eye blinking, organic head tilting, springy antenna,
 * responsive limb gestures (waving, celebrating, dancing, thinking),
 * and dynamic glowing digital face expressions.
 */
export default function SnaBotCharacter({
  mood = "idle",
  gesture = "",
  className = "",
}) {
  const activeAction = gesture || mood || "idle";

  return (
    <svg
      className={`sna-bot-svg is-mood-${mood} is-action-${activeAction} ${className}`}
      viewBox="0 0 120 144"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="SNA Bot Character"
    >
      <defs>
        {/* Glow filter for eyes, antenna orb, and reactor core */}
        <filter id="sna-bot-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Soft shadow for depth under plates */}
        <filter id="sna-bot-shadow-blur" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.8" />
        </filter>

        {/* Armor highlights & metallics */}
        <linearGradient id="sna-armor-highlight" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
          <stop offset="40%" stopColor="#ffffff" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.22" />
        </linearGradient>

        {/* Visor deep obsidian gradient */}
        <linearGradient id="sna-visor-bg" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#141a32" />
          <stop offset="60%" stopColor="#0b0f20" />
          <stop offset="100%" stopColor="#060914" />
        </linearGradient>

        {/* Torso core reactor glow */}
        <radialGradient id="sna-reactor-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#e0f7ff" />
          <stop offset="45%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#0284c7" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* 1. Dynamic Ground Shadow (scales & breathes inversely with hover height) */}
      <ellipse
        className="sna-bot-ground-shadow"
        cx="60"
        cy="134"
        rx="26"
        ry="4.5"
        fill="rgba(15, 23, 42, 0.32)"
      />

      {/* 2. Floating Articulated Character Rig */}
      <g className="sna-bot-rig">
        {/* Anti-gravity Thruster / Hover Plasma Rings */}
        <g className="sna-bot-thruster" aria-hidden="true">
          <ellipse
            className="sna-bot-thruster-halo"
            cx="60"
            cy="114"
            rx="15"
            ry="4.2"
            fill="url(#sna-reactor-glow)"
          />
          <ellipse
            className="sna-bot-thruster-ring"
            cx="60"
            cy="113"
            rx="11"
            ry="3.2"
            stroke="#38bdf8"
            strokeWidth="1.6"
            fill="none"
          />
          <ellipse
            className="sna-bot-thruster-core"
            cx="60"
            cy="113"
            rx="5.5"
            ry="1.8"
            fill="#e0f7ff"
            filter="url(#sna-bot-glow)"
          />
        </g>

        {/* Torso & Chassis */}
        <g className="sna-bot-torso-group">
          {/* Torso main armor shell */}
          <rect
            className="sna-bot-armor-body"
            x="41"
            y="72"
            width="38"
            height="36"
            rx="18"
            fill="var(--sna-bot-color, #4f46e5)"
          />
          {/* Metallic lighting overlay */}
          <rect
            x="41"
            y="72"
            width="38"
            height="36"
            rx="18"
            fill="url(#sna-armor-highlight)"
          />
          {/* Torso white/silver chest plate */}
          <rect
            className="sna-bot-chest-plate"
            x="46"
            y="77"
            width="28"
            height="25"
            rx="12"
            fill="#f8fafc"
            stroke="#cbd5e1"
            strokeWidth="0.8"
          />

          {/* Glowing Arc Reactor Core */}
          <g className="sna-bot-reactor" filter="url(#sna-bot-glow)">
            <circle
              className="sna-bot-reactor-outer"
              cx="60"
              cy="89"
              r="6.8"
              fill="#0ea5e9"
              opacity="0.3"
            />
            <circle
              className="sna-bot-reactor-mid"
              cx="60"
              cy="89"
              r="4.8"
              fill="#38bdf8"
            />
            <circle
              className="sna-bot-reactor-core"
              cx="60"
              cy="89"
              r="2.6"
              fill="#ffffff"
            />
          </g>

          {/* Magnetic neck joint hover gap */}
          <ellipse
            className="sna-bot-neck-joint"
            cx="60"
            cy="68"
            rx="7"
            ry="2.4"
            fill="#1e293b"
            stroke="#38bdf8"
            strokeWidth="0.8"
          />
        </g>

        {/* Left Arm (Shoulder pivot at 36, 78) */}
        <g className="sna-bot-arm sna-bot-arm-left">
          {/* Shoulder ball */}
          <circle
            className="sna-bot-shoulder"
            cx="36"
            cy="78"
            r="4.8"
            fill="#1e293b"
          />
          {/* Upper arm & forearm sleeve */}
          <rect
            className="sna-bot-arm-limb"
            x="27"
            y="77"
            width="9.5"
            height="18"
            rx="4.7"
            fill="var(--sna-bot-color, #4f46e5)"
          />
          <rect
            x="27"
            y="77"
            width="9.5"
            height="18"
            rx="4.7"
            fill="url(#sna-armor-highlight)"
          />
          {/* Robotic mitten / hand */}
          <circle
            className="sna-bot-hand"
            cx="31.5"
            cy="99"
            r="5.4"
            fill="#f8fafc"
            stroke="#94a3b8"
            strokeWidth="0.8"
          />
          {/* Palm accent */}
          <circle cx="31.5" cy="99" r="2.2" fill="#38bdf8" opacity="0.65" />
        </g>

        {/* Right Arm (Shoulder pivot at 84, 78) */}
        <g className="sna-bot-arm sna-bot-arm-right">
          {/* Shoulder ball */}
          <circle
            className="sna-bot-shoulder"
            cx="84"
            cy="78"
            r="4.8"
            fill="#1e293b"
          />
          {/* Upper arm & forearm sleeve */}
          <rect
            className="sna-bot-arm-limb"
            x="83.5"
            y="77"
            width="9.5"
            height="18"
            rx="4.7"
            fill="var(--sna-bot-color, #4f46e5)"
          />
          <rect
            x="83.5"
            y="77"
            width="9.5"
            height="18"
            rx="4.7"
            fill="url(#sna-armor-highlight)"
          />
          {/* Robotic mitten / hand */}
          <circle
            className="sna-bot-hand"
            cx="88.5"
            cy="99"
            r="5.4"
            fill="#f8fafc"
            stroke="#94a3b8"
            strokeWidth="0.8"
          />
          {/* Palm accent */}
          <circle cx="88.5" cy="99" r="2.2" fill="#38bdf8" opacity="0.65" />
        </g>

        {/* Head & Face Group (Neck pivot at 60, 60) */}
        <g className="sna-bot-head-group">
          {/* Ear Audio Pods */}
          <g className="sna-bot-ears">
            {/* Left ear */}
            <rect
              className="sna-bot-ear"
              x="22"
              y="32"
              width="7.5"
              height="22"
              rx="3.7"
              fill="#1e293b"
            />
            <rect
              className="sna-bot-ear-accent"
              x="23"
              y="37"
              width="4.5"
              height="12"
              rx="2.2"
              fill="#38bdf8"
              filter="url(#sna-bot-glow)"
            />

            {/* Right ear */}
            <rect
              className="sna-bot-ear"
              x="90.5"
              y="32"
              width="7.5"
              height="22"
              rx="3.7"
              fill="#1e293b"
            />
            <rect
              className="sna-bot-ear-accent"
              x="92.5"
              y="37"
              width="4.5"
              height="12"
              rx="2.2"
              fill="#38bdf8"
              filter="url(#sna-bot-glow)"
            />
          </g>

          {/* Top Antenna */}
          <g className="sna-bot-antenna">
            {/* Flexible stalk */}
            <path
              className="sna-bot-antenna-stalk"
              d="M 60 17 Q 59 9 63.5 5.5"
              stroke="#1e293b"
              strokeWidth="2.8"
              strokeLinecap="round"
              fill="none"
            />
            {/* Glowing neon tip orb */}
            <circle
              className="sna-bot-antenna-orb"
              cx="64.5"
              cy="5.5"
              r="4.6"
              fill="#38bdf8"
              filter="url(#sna-bot-glow)"
            />
            <circle cx="63.5" cy="4.2" r="1.5" fill="#ffffff" />

            {/* Animated radio wave signal arcs (listening & thinking) */}
            <path
              className="sna-bot-signal-arc sna-signal-1"
              d="M 57 2 A 9 9 0 0 1 72 2"
              stroke="#38bdf8"
              strokeWidth="1.6"
              strokeLinecap="round"
              fill="none"
            />
            <path
              className="sna-bot-signal-arc sna-signal-2"
              d="M 53 -3 A 15 15 0 0 1 76 -3"
              stroke="#38bdf8"
              strokeWidth="1.6"
              strokeLinecap="round"
              fill="none"
            />
          </g>

          {/* Helmet Outer Shell */}
          <rect
            className="sna-bot-armor-head"
            x="27"
            y="16"
            width="66"
            height="48"
            rx="23"
            fill="var(--sna-bot-color, #4f46e5)"
          />
          {/* Metallic curvature shading */}
          <rect
            x="27"
            y="16"
            width="66"
            height="48"
            rx="23"
            fill="url(#sna-armor-highlight)"
          />
          {/* Specular top gloss curve */}
          <path
            d="M 37 22 C 46 19 74 19 83 22"
            stroke="rgba(255, 255, 255, 0.75)"
            strokeWidth="2.2"
            strokeLinecap="round"
            fill="none"
          />

          {/* Dark Cyber Visor Screen */}
          <rect
            className="sna-bot-visor"
            x="33"
            y="23"
            width="54"
            height="34"
            rx="15"
            fill="url(#sna-visor-bg)"
            stroke="#1e293b"
            strokeWidth="1"
          />
          {/* Visor internal curvature gloss */}
          <path
            d="M 38 27 C 46 25 74 25 82 27 C 75 29 45 29 38 27 Z"
            fill="rgba(255, 255, 255, 0.16)"
          />

          {/* Face Display Elements (Cyan Neon Cyber-Face) */}
          <g className="sna-bot-face" filter="url(#sna-bot-glow)">
            {/* Soft Glowing Blush (Active on Wave, Celebrate, Dance, Hello, Success) */}
            <g className="sna-bot-blush-group">
              <ellipse
                className="sna-bot-blush"
                cx="39"
                cy="46"
                rx="3.5"
                ry="2.2"
                fill="#f472b6"
                opacity="0.8"
              />
              <ellipse
                className="sna-bot-blush"
                cx="81"
                cy="46"
                rx="3.5"
                ry="2.2"
                fill="#f472b6"
                opacity="0.8"
              />
            </g>

            {/* A. Normal Idle / Blinking Eyes */}
            <g className="sna-bot-eyes-normal">
              {/* Left Eye */}
              <g className="sna-bot-eye-unit sna-bot-eye-l">
                <rect
                  className="sna-bot-eye-shape"
                  x="43"
                  y="32"
                  width="7.5"
                  height="13"
                  rx="3.7"
                  fill="#38bdf8"
                />
                <circle cx="45.5" cy="35" r="1.5" fill="#ffffff" />
              </g>

              {/* Right Eye */}
              <g className="sna-bot-eye-unit sna-bot-eye-r">
                <rect
                  className="sna-bot-eye-shape"
                  x="69.5"
                  y="32"
                  width="7.5"
                  height="13"
                  rx="3.7"
                  fill="#38bdf8"
                />
                <circle cx="72" cy="35" r="1.5" fill="#ffffff" />
              </g>
            </g>

            {/* B. Happy Smiling Eyes (^ ^) */}
            <g className="sna-bot-eyes-happy">
              <path
                d="M 42 41 Q 47 32 52 41"
                stroke="#38bdf8"
                strokeWidth="3.2"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M 68 41 Q 73 32 78 41"
                stroke="#38bdf8"
                strokeWidth="3.2"
                strokeLinecap="round"
                fill="none"
              />
            </g>

            {/* C. Thinking Eyes (Inquisitive upward glance + raised brow) */}
            <g className="sna-bot-eyes-thinking">
              <circle cx="49" cy="35" r="4.8" fill="#38bdf8" />
              <circle cx="50.2" cy="33.8" r="1.5" fill="#ffffff" />
              <circle cx="75" cy="33" r="4.8" fill="#38bdf8" />
              <circle cx="76.2" cy="31.8" r="1.5" fill="#ffffff" />
              <path
                d="M 69 26 Q 75 23 81 27"
                stroke="#38bdf8"
                strokeWidth="2.2"
                strokeLinecap="round"
                fill="none"
              />
            </g>

            {/* D. Surprised Eyes (Wide O O) */}
            <g className="sna-bot-eyes-surprised">
              <circle cx="47" cy="38" r="6.8" fill="#38bdf8" />
              <circle cx="47" cy="38" r="3.2" fill="#0b0f20" />
              <circle cx="49" cy="36" r="1.4" fill="#ffffff" />

              <circle cx="73" cy="38" r="6.8" fill="#38bdf8" />
              <circle cx="73" cy="38" r="3.2" fill="#0b0f20" />
              <circle cx="75" cy="36" r="1.4" fill="#ffffff" />
            </g>

            {/* E. Sad Eyes (Downward curve) */}
            <g className="sna-bot-eyes-sad">
              <path
                d="M 42 37 Q 47 44 52 38"
                stroke="#38bdf8"
                strokeWidth="3.2"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M 68 38 Q 73 44 78 37"
                stroke="#38bdf8"
                strokeWidth="3.2"
                strokeLinecap="round"
                fill="none"
              />
            </g>

            {/* F. Error / Dizzy Eyes (> <) */}
            <g className="sna-bot-eyes-error">
              <path
                d="M 43 34 L 50 39.5 L 43 45"
                stroke="#f43f5e"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
              <path
                d="M 77 34 L 70 39.5 L 77 45"
                stroke="#f43f5e"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </g>

            {/* G. Angry Eyes (\ /) & Head Anger Mark */}
            <g className="sna-bot-eyes-angry">
              <path
                d="M 43 33 L 52 38 L 44 42"
                stroke="#ef4444"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
              <path
                d="M 77 33 L 68 38 L 76 42"
                stroke="#ef4444"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </g>

            {/* H. Tired Eyes & Sweat Drop */}
            <g className="sna-bot-eyes-tired">
              <line x1="42" y1="36" x2="52" y2="39" stroke="#38bdf8" strokeWidth="2.8" strokeLinecap="round" />
              <path d="M 43 41 Q 47 43 51 41" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" fill="none" />
              <line x1="78" y1="36" x2="68" y2="39" stroke="#38bdf8" strokeWidth="2.8" strokeLinecap="round" />
              <path d="M 69 41 Q 73 43 77 41" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" fill="none" />
            </g>

            {/* I. Sleepy Closed Eyes (- -) */}
            <g className="sna-bot-eyes-sleep">
              <path
                d="M 42 39 Q 47 44 52 39"
                stroke="#38bdf8"
                strokeWidth="3"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M 68 39 Q 73 44 78 39"
                stroke="#38bdf8"
                strokeWidth="3"
                strokeLinecap="round"
                fill="none"
              />
            </g>

            {/* J. Working / Focused Cyber HUD Eyes */}
            <g className="sna-bot-eyes-working">
              <rect x="42.5" y="33" width="8" height="11" rx="2" fill="#38bdf8" />
              <rect x="69.5" y="33" width="8" height="11" rx="2" fill="#38bdf8" />
              <line className="sna-bot-working-scan" x1="39" y1="38" x2="81" y2="38" stroke="#67e8f9" strokeWidth="1.5" strokeDasharray="3 2" />
            </g>

            {/* K. Hungry Eyes (Eager wide eyes with longing drool) */}
            <g className="sna-bot-eyes-hungry">
              <circle cx="47" cy="38" r="6.2" fill="#38bdf8" />
              <circle cx="49" cy="35.5" r="2.2" fill="#ffffff" />
              <circle cx="73" cy="38" r="6.2" fill="#38bdf8" />
              <circle cx="75" cy="35.5" r="2.2" fill="#ffffff" />
              <path d="M 56 46 Q 60 52 64 46" stroke="#38bdf8" strokeWidth="2.2" strokeLinecap="round" fill="none" />
              <path className="sna-bot-drool" d="M 64 47 C 64 47 65 52 64 53 C 63 54 62 53 62 52 C 62 50 64 47 64 47 Z" fill="#38bdf8" />
            </g>

            {/* L. Yawning / Waking Eyes & Mouth (Squint with cute sleepiness tear and yawning mouth) */}
            <g className="sna-bot-eyes-yawn">
              <path
                d="M 42 38 Q 47 33 52 38"
                stroke="#38bdf8"
                strokeWidth="3.2"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M 68 38 Q 73 33 78 38"
                stroke="#38bdf8"
                strokeWidth="3.2"
                strokeLinecap="round"
                fill="none"
              />
              <circle cx="79.5" cy="41" r="1.4" fill="#38bdf8" />
              {/* Wide cute yawning mouth inside visor */}
              <ellipse cx="60" cy="47" rx="4.8" ry="6" fill="#0b0f20" stroke="#38bdf8" strokeWidth="1.4" />
              <path d="M 57 48 Q 60 51.5 63 48" stroke="#f472b6" strokeWidth="1.6" strokeLinecap="round" fill="none" />
            </g>

            {/* Speech Waveform Equalizer (Animated during speaking mood) */}
            <g className="sna-bot-voice-bars">
              <rect className="sna-voice-bar vb-1" x="51.5" y="47" width="2.8" height="4" rx="1.4" fill="#38bdf8" />
              <rect className="sna-voice-bar vb-2" x="56" y="46" width="2.8" height="6" rx="1.4" fill="#38bdf8" />
              <rect className="sna-voice-bar vb-3" x="61" y="46" width="2.8" height="6" rx="1.4" fill="#38bdf8" />
              <rect className="sna-voice-bar vb-4" x="65.5" y="47" width="2.8" height="4" rx="1.4" fill="#38bdf8" />
            </g>
          </g>

          {/* Hungry Food / Rice Bowl FX */}
          <g className="sna-bot-food-fx" aria-hidden="true">
            <path
              className="sna-bot-rice-bowl"
              d="M 83 23 C 83 28 89 31 94 31 C 99 31 105 28 105 23 Z"
              fill="#f8fafc"
              stroke="#38bdf8"
              strokeWidth="1.2"
            />
            <path d="M 81 23 L 107 23" stroke="#38bdf8" strokeWidth="1.2" strokeLinecap="round" />
            <path className="sna-bot-food-steam s1" d="M 89 20 Q 91 16 89 13" stroke="#38bdf8" strokeWidth="1.2" strokeLinecap="round" fill="none" />
            <path className="sna-bot-food-steam s2" d="M 94 19 Q 96 15 94 12" stroke="#38bdf8" strokeWidth="1.2" strokeLinecap="round" fill="none" />
            <path className="sna-bot-food-steam s3" d="M 99 20 Q 101 16 99 13" stroke="#38bdf8" strokeWidth="1.2" strokeLinecap="round" fill="none" />
          </g>

          {/* Coffee Mug FX (Warm coffee & rising steam) */}
          <g className="sna-bot-coffee-fx" aria-hidden="true">
            {/* Mug Body */}
            <rect
              className="sna-bot-coffee-mug"
              x="83"
              y="22"
              width="15"
              height="14"
              rx="3"
              fill="#f8fafc"
              stroke="#38bdf8"
              strokeWidth="1.2"
            />
            {/* Mug Handle */}
            <path
              className="sna-bot-coffee-handle"
              d="M 98 24.5 C 102 24.5 102 32.5 98 32.5"
              stroke="#38bdf8"
              strokeWidth="1.3"
              fill="none"
            />
            {/* Dark Rich Coffee liquid */}
            <ellipse cx="90.5" cy="23" rx="6" ry="2" fill="#78350f" />
            {/* Warm Coffee Steams */}
            <path className="sna-bot-coffee-steam cs1" d="M 87 20 Q 89 16 87 13" stroke="#38bdf8" strokeWidth="1.2" strokeLinecap="round" fill="none" />
            <path className="sna-bot-coffee-steam cs2" d="M 91 19 Q 93 15 91 12" stroke="#38bdf8" strokeWidth="1.2" strokeLinecap="round" fill="none" />
            <path className="sna-bot-coffee-steam cs3" d="M 95 20 Q 97 16 95 13" stroke="#38bdf8" strokeWidth="1.2" strokeLinecap="round" fill="none" />
          </g>

          {/* Anger Pulsing Tick Mark */}
          <g className="sna-bot-anger-fx" aria-hidden="true">
            <path
              className="sna-bot-anger-cross"
              d="M 76 17 L 84 17 M 80 13 L 80 21"
              stroke="#ef4444"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
          </g>

          {/* Tired Sweat Drop */}
          <g className="sna-bot-sweat-fx" aria-hidden="true">
            <path
              className="sna-bot-sweat-drop"
              d="M 87 26 C 87 23 90 19 90 19 C 90 19 93 23 93 26 C 93 28 92 29.5 90 29.5 C 88 29.5 87 28 87 26 Z"
              fill="#38bdf8"
              filter="url(#sna-bot-glow)"
            />
          </g>

          {/* Sleep Floating Zzz Group */}
          <g className="sna-bot-zzz-group" aria-hidden="true">
            <text x="86" y="22" className="sna-bot-zzz z1" fill="#38bdf8" fontSize="8" fontWeight="bold">z</text>
            <text x="95" y="15" className="sna-bot-zzz z2" fill="#38bdf8" fontSize="11" fontWeight="bold">Z</text>
            <text x="105" y="7" className="sna-bot-zzz z3" fill="#38bdf8" fontSize="14" fontWeight="bold">Z</text>
          </g>
        </g>

        {/* Holographic Working HUD (Keyboard & Cyber Screen) */}
        <g className="sna-bot-work-hud" aria-hidden="true">
          <polygon
            points="34,103 86,103 94,115 26,115"
            fill="rgba(56, 189, 248, 0.22)"
            stroke="#38bdf8"
            strokeWidth="1.2"
          />
          <line x1="38" y1="107" x2="82" y2="107" stroke="#67e8f9" strokeWidth="1.2" strokeDasharray="3 2" />
          <line x1="31" y1="111" x2="89" y2="111" stroke="#67e8f9" strokeWidth="1.2" strokeDasharray="4 3" />
        </g>

        {/* 3. Celebration / Magic Sparkles (Twinkle during celebrate / success) */}
        <g className="sna-bot-sparkles" aria-hidden="true">
          <path
            className="sna-bot-sparkle sp-1"
            d="M 21 26 Q 25 26 25 22 Q 25 26 29 26 Q 25 26 25 30 Q 25 26 21 26 Z"
            fill="#facc15"
          />
          <path
            className="sna-bot-sparkle sp-2"
            d="M 94 20 Q 98 20 98 16 Q 98 20 102 20 Q 98 20 98 24 Q 98 20 94 20 Z"
            fill="#facc15"
          />
          <path
            className="sna-bot-sparkle sp-3"
            d="M 97 70 Q 100 70 100 67 Q 100 70 103 70 Q 100 70 100 73 Q 100 70 97 70 Z"
            fill="#38bdf8"
          />
        </g>
      </g>
    </svg>
  );
}

