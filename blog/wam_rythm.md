---
title: The Rhythm of a Robot
subtitle: A Beginner’s Journey Through Frequency-Based Policies, Flow Matching, and World-Action Models
date: 2026-09-26
description: An accessible guide to frequency-based robot policies, flow matching, and world-action models, from motion representations to closed-loop execution.
tags: [Robot Learning, WAM]
lang: en
---

# The Rhythm of a Robot

## 1. A robot reaches for a cup and almost gets it right

Imagine watching a robot pick up a cup.

Its arm glides across the table. Its hand arrives in the right neighborhood. Everything looks promising. Then the fingers close a little too early, brush the handle, and push the cup away.

From a distance, the movement looked almost perfect. From the cup’s point of view, it was a complete failure.

That contrast is a useful place to start. A successful robot action has an overall shape, but it also has timing, corrections, and contacts that can be tiny in numerical terms and still decide whether the task succeeds. How should a learning system represent all of that?

One answer is to treat the movement as a signal and listen to its different rhythms.

This is the central idea behind frequency-based robot policies. You do not need Fourier equations to understand it. We can begin with something much simpler: a list of numbers.

### From a movement to a list

Suppose we record the angle of one joint at evenly spaced moments:

| Time | Joint angle |
|---|---:|
| 0.00 seconds | 10° |
| 0.04 seconds | 15° |
| 0.08 seconds | 22° |

This is a **time-series signal**, a quantity whose value changes over time. “Signal” does not have to mean a radio transmission. Temperature, microphone pressure, and a robot joint angle are all signals.

A robot with seven joints has seven of these angle signals. Its commands might instead describe joint velocities, motor torques, an end-effector pose, or how wide the gripper opens. The physical meaning changes, but the time-series view stays useful.

A **policy** is the system that decides which actions to take based on the information it has. A **vision-language-action model**, or **VLA**, turns visual observations and a language instruction into actions. Some frequency-based policies are VLAs. Others are visuomotor policies that use no language at all. The two families are close neighbors in research, but the names are not interchangeable.

Instead of predicting a single command, a policy can predict an **action chunk**, which is a short sequence of future commands. Generating continuous actions in chunks is central to methods such as Diffusion Policy. [^diffusion]

For example, a hypothetical controller might predict 50 commands for the next second, execute the first few, and then look again. If each command contains seven numbers, the chunk is a 50 by 7 array:

\[
A\in\mathbb{R}^{H\times d},
\]

where \(H\) is the number of future steps and \(d\) is the action dimension.

In the **time domain**, each row answers one question: “What should the robot do at this moment?”

Frequency-domain methods organize the same information around a different question.

## 2. A trajectory has a rhythm even when it does not repeat

Think about a recording of a piano chord.

One description tells us how the air pressure changes at every instant. Another tells us which oscillations combine to make the sound. These are not two different sounds. They are two ways of describing the same one.

We can make a similar change of coordinates for an action chunk.

Instead of describing a trajectory as “the angle at step one, the angle at step two, the angle at step three,” we describe it as a blend of slowly varying and rapidly varying patterns.

A **discrete cosine transform**, or **DCT**, uses cosine-shaped patterns. A **discrete Fourier transform**, or **DFT**, uses sinusoidal components with complex coefficients. Neither transform requires the robot’s movement to repeat like a dance. A finite sequence that never repeats can still be expanded in these basis functions.

For an orthonormal DCT, the bookkeeping is especially clean:

\[
C=QA,
\qquad
A=Q^\top C.
\]

Here \(Q\) is a fixed transform matrix, \(A\) holds the time-domain commands, and \(C\) holds their frequency coefficients. The transpose \(Q^\top\) performs the inverse transform. Standard implementations document these orthonormal conventions explicitly. [^dct]

The transform runs **along time**, separately for each action dimension. We do not pretend that joint one, joint two, and joint three are consecutive moments of a single signal.

### What low and high frequency actually mean

A low-frequency pattern changes slowly across the chunk. A high-frequency pattern changes quickly. The zero-frequency component, often called **DC**, captures a constant offset tied to the sequence’s average.

A coefficient tells us how much of one pattern to include. It does **not** tell us what to do at any particular moment.

This distinction matters. The first few frequency coefficients are not the first few robot commands. Together they describe the entire chunk at a coarse time scale.

For intuition, imagine a trajectory with a slow overall trend and a tiny, rapid wobble:

\[
q(t)=0.2t+0.005\sin(20\pi t),
\]

with time in seconds and angle in radians. The second term oscillates ten times per second, but its amplitude is small. We could make that wobble larger without changing its frequency at all.

**Frequency measures how quickly something varies, not how large or how important it is.**

That fact corrects a tempting shortcut:

> Low frequency can describe a broad movement trend, and high frequency can describe rapid corrections. But “low frequency means coarse” and “high frequency means precise” are not physical laws.

A very slow insertion can be extremely precise. A fast swing can be large and crude. A sudden gripper closing may need plenty of high-frequency content without being a delicate adjustment.

### Changing coordinates is not yet compression

If we keep every DCT coefficient, we can recover the original sequence exactly, apart from rounding. Compression only begins when we drop coefficients, quantize their values, or encode them more compactly.

There is a second subtlety. A spectrum is more than a list of magnitudes. In a Fourier representation, phase decides when the components line up, and in a DCT the signs of the coefficients matter too. Two signals with similar spectral magnitudes can still have very different timing.

A robot does not just need the right ingredients. It needs them to arrive together at the right moment.

## 3. Most of the drawing may need only a few brushstrokes

Back to the cup.

The arm spends most of its time approaching smoothly. Only a small part of the movement involves abrupt changes or quick corrections. So it is plausible that a fairly small set of low-frequency coefficients can capture much of a demonstrated trajectory’s overall shape.

The paper **Hierarchical Policy Learning via Spectral Decomposition** reports that, in its benchmark analysis, roughly the lowest 30% of DCT coefficients usually account for 90% of the measured spectral energy. This is an empirical observation under that paper’s settings, not a universal constant of robot motion. [^csp]

The word **energy** needs care here. Spectral energy means the squared magnitude of the signal in the chosen representation. It is not the robot’s mechanical energy, and it is certainly not a percentage of task success.

Imagine drawing a key. A few strokes capture its length and outline. A tiny notch adds almost nothing to the drawing’s total area, yet it decides whether the key opens the lock.

Robot trajectories can have the same imbalance. A component can look small in a numerical summary and still be critical for the timing or alignment of a contact.

This leaves us with two goals that seem to pull against each other. We want to exploit the simplicity of the broad trajectory, but we must not erase the details that decide the task.

Much of this research area can be read as a series of attempts to reconcile those two goals.

## 4. The first move: stop spelling out every action independently

A friendly entry point into the modern literature is **FAST: Efficient Action Tokenization for Vision-Language-Action Models**, introduced in January 2025.

FAST applies a DCT to action chunks, quantizes the coefficients, and compresses them into tokens that autoregressive models can predict. Its main concern is an efficient action vocabulary. It asks how to avoid describing highly correlated continuous actions with a long, clumsy token sequence. [^fast]

Think of the difference between describing a melody one audio sample at a time and describing its musical structure. The analogy is imperfect, but it captures the motivation: neighboring samples are often redundant.

FAST is mainly an intervention in **representation and tokenization**. On its own, it does not show that a robot should generate every low-frequency coefficient before every high-frequency one. Nor does it imply that every frequency method must produce discrete tokens.

### Why wavelets enter the story

DCT basis functions stretch across the whole chunk. That suits global structure, but consider a sudden contact near the end of an otherwise smooth movement. Then we care not only about which time scales are present, but also about **where in the sequence** they appear.

Wavelets offer a multiscale representation that keeps this sense of location. Roughly speaking, they describe the broad structure together with details tied to particular places and scales.

The April 2025 version of **Wavelet Policy** used a shared encoder with several frequency-oriented decoders and learnable filtering in the frequency domain. A substantially revised version from June 2026, titled **Wavelet Policy: Imitation Learning in the Scale Domain with World Prior Memory**, decomposes horizon-aligned latent action tokens and adds scene-related world prior memory and adaptation. The two versions should not be described as the same method. [^wavelet-v1] [^wavelet-v5]

The broader lesson is that “frequency-based” does not always mean “a DCT applied to the final motor commands.” The decomposition can live in an intermediate representation, and different mathematical bases reveal different kinds of structure.

## 5. Two specialists are not the same thing as a sequence

At this point, two design ideas can sound almost identical:

> Learn low and high frequencies separately.

> Generate low frequencies first, then add higher frequencies.

They are related, but they answer different questions.

**Separate learning is about dividing the labor. Progressive generation is about dependency and order.**

Imagine two illustrators working from the same brief. One draws the broad outline, and the other draws the details. If they work independently and merge their drawings at the end, the labor is divided but there is no required order.

A hypothetical policy could work like this:

```text
                  ┌── Low-frequency predictor ──┐
Observation ──────┤                              ├── Inverse transform ── Actions
                  └── High-frequency predictor ─┘
```

Now imagine the detail artist receives the finished outline first and draws the details on top of it. That creates a dependency:

```text
Observation ── Low-frequency prediction
                         │
                         ▼
             High-frequency prediction
                         │
                         ▼
                Reconstructed actions
```

A schematic probabilistic version is:

\[
p(C_L,C_H\mid o)
=
p(C_L\mid o)\,p(C_H\mid o,C_L).
\]

The second predictor knows which coarse trajectory the first one chose. That matters when several broad motions are possible, because the fine corrections that suit one approach may not fit another.

### Two papers and one naming trap

**FreqPolicy: Frequency Autoregressive Visuomotor Policy with Continuous Tokens**, first released in June 2025 and published at NeurIPS 2025, puts coarse-to-fine frequency progression at its center. It uses frequency-level reconstructions, continuous latent tokens, and diffusion-based generation, rather than simply predicting one raw DCT coefficient at a time. [^freq-ar]

To keep things clear, this article calls it **FreqPolicy-AR**. That is only a label for this article, not an official name.

The June 2026 spectral decomposition paper introduces **Causal Spectral Policy**, or **CSP**. The paper title and the method name refer to the **same work**, not two separate papers. CSP uses separate low-frequency and high-frequency predictors, and it conditions the high-frequency prediction on the coarse result. So it combines specialization **and** coarse-to-fine ordering. [^csp]

This means “parallel specialists versus progressive generation” is a useful way to think, but it is not accurate to say that CSP is purely parallel while FreqPolicy-AR is sequential.

### The robot is not executing the low frequencies first

This point is easy to misread.

Generating a broad trajectory and then refining it is usually an **internal computation** that happens before any command is sent. Low-frequency components shape the whole modeled interval, and higher-frequency components can refine any part of it.

It does not mean the physical robot first performs a “low-frequency phase,” pauses, and then performs the missing high frequencies.

The painter finishes the picture before handing it over. The robot receives the reconstructed sequence and executes its commands in real time.

## 6. The loss is the grading rule, not the student

We have been talking about what different modules “learn.” What does learning actually mean?

Suppose the policy predicts a chunk \(\hat A\), and a demonstration provides the target \(A\). A simple squared-error loss is:

\[
\mathcal{L}=\|\hat A-A\|_F^2.
\]

The subscript only says that we add up the squared differences over every entry of the array.

The loss is a score. Backpropagation works out how changing the model’s parameters would change that score, and an optimizer then updates the parameters to lower it.

In the usual setup, **the model’s parameters are learned, and the researcher writes down the loss**.

Some methods also learn weights inside the objective. That does not mean the loss appears by itself. Learned weights need a principled formulation, or the system can “solve” the problem simply by ignoring the hard targets.

### Separating supervision does not require separating networks

After transforming the target, we could define:

\[
\mathcal{L}
=
\underbrace{\|\hat C_L-C_L\|^2}_{\text{low-band error}}
+
\lambda
\underbrace{\|\hat C_H-C_H\|^2}_{\text{high-band error}}.
\]

Changing \(\lambda\) changes the grading rule. It does not require two neural networks. A single network can receive both losses.

In the other direction, two separate prediction heads can be trained with one summed objective. Architecture and supervision are independent design choices.

### The mathematical catch: new coordinates are not a new loss

Let \(Q\) be an orthonormal DCT matrix. Then:

\[
\|\hat A-A\|_F^2
=
\|Q\hat A-QA\|_F^2
=
\|\hat C-C\|_F^2.
\]

This holds because \(Q^\top Q=I\). An orthonormal change of coordinates preserves squared distance.

So if we take the same prediction, transform both the prediction and the target, and add up every coefficient error with equal weight, we have **not** created a new objective.

Likewise, naming the two parts “low-frequency loss” and “high-frequency loss” changes nothing if we simply add them back together with the same weights and the same gradient paths.

Something real has to change: the relative weights, the normalization, how the model is factored, how gradients flow, a compressed representation, a constraint, or the generation procedure.

This also explains why the claim “time-domain MSE fundamentally cannot learn high frequencies” goes too far. Depending on the data and the current errors, large-scale errors may dominate training. But the choice of coordinates alone does not make squared error blind to rapid variation.

### Why not just multiply the high-frequency loss by ten?

Because high-frequency detail is not automatically useful detail.

Imagine a demonstration that contains both a precise corrective motion and the operator’s hand tremor. Both add rapid variation. Raising the high-frequency weight rewards the model for copying both.

There is a further statistical nuance. Ideal white noise has a flat expected power spectrum, so it is not concentrated only at high frequencies. But if the useful trajectory is mostly low-frequency, the high-frequency bands can have a worse **signal-to-noise ratio**, meaning less useful motion relative to the noise in those bands. Slow drift can contaminate the low frequencies as well.

FreqPolicy-AR reports robustness to noisy demonstrations, but the result should not be stretched into “every baseline fails at a noise standard deviation of 0.1.” In its reported six-task average at that setting, it reaches 33%, compared with 23% for DP3 and 19% for Mamba. The setting, the action normalization, and the individual task all matter. [^freq-ar]

The real challenge is not simply “pay more attention to high frequency.” It is “keep the changes that matter without faithfully copying the noise.”

## 7. Generating a trajectory from static

So far we have discussed what the policy predicts and how we grade it. One question remains: **how does the policy produce a plausible action sequence in the first place?**

Suppose a bottle blocks the direct path to the cup. Going around on the left and going around on the right may both appear in the demonstrations. Averaging the two paths could send the arm straight into the bottle.

This thought experiment shows why a policy may need to represent a distribution of possible actions rather than a single average. Diffusion Policy is one example. It learns a conditional distribution over actions through a denoising process. [^diffusion]

Flow matching offers a related way to build continuous generative models.

### Two clocks, not one

Let \(t\) be the robot’s physical time. Now introduce a separate variable \(\tau\) for the generator’s internal progress from noise to an action chunk.

In the simplest straight-path construction, take a random starting sample \(X_0\) and a demonstrated action chunk \(X_1\), and form:

\[
X_\tau=(1-\tau)X_0+\tau X_1.
\]

A neural network learns a vector field \(v_\theta(X_\tau,\tau,\text{context})\) that points along this path. For this simple construction, the target direction is \(X_1-X_0\). At inference time, the model starts from a random sample and numerically follows its learned field until it reaches an action sample. This is the basic idea of flow matching. [^flow]

Here, **velocity means change with respect to generation time \(\tau\)**. It is not necessarily a physical joint velocity. Even when the output commands are joint positions, the generator still predicts a flow velocity over the array of positions.

One internal refinement step updates the candidate chunk. One physical control step executes a command. They are different operations running on different clocks.

### The other FreqPolicy

There is a second, separate NeurIPS 2025 paper: **FreqPolicy: Efficient Flow-based Visuomotor Policy via Frequency Consistency**.

This article calls it **FreqPolicy-FC**. It enforces frequency-domain consistency between flow velocity predictions made at different generation times, with adaptive frequency weighting, so that generation stays efficient, even down to a single inference step. Its key idea is different from the frequency-level autoregressive procedure in FreqPolicy-AR. [^freq-fc]

So “spectral consistency” always invites a follow-up question: **consistency between what and what?** Between two solver times? Between a prediction and a demonstration? Between overlapping chunks? The phrase alone does not specify a method.

### FAFM: represent the whole curve, including how it changes

**Frequency-Aware Flow Matching for Continuous and Consistent Robotic Action Generation**, or **FAFM**, works on DCT coefficients and uses a continuous-time representation of actions. It also supervises the trajectory’s analytic time derivative. Its analysis links this derivative-matching term to frequency-dependent penalties of the form \(1+\lambda\omega_k^2\). [^fafm]

The distinction is important. Matching the demonstrated derivative is not the same as penalizing every nonzero derivative. The first says, “Change in the right way.” The second says, “Avoid changing.” A useful action may need motion, acceleration, and sharp transitions.

### FreqFM: keep the network, change the transport problem

The September 2026 paper **Frequency-Conditioned Flow Matching for Vision-Language-Action Models**, or **FreqFM**, changes three parts of the flow formulation. It uses a Gaussian source whose spectrum is matched to the actions, a spectrum-aware objective with learned frequency weights, and frequency-wise limits on sampling guidance. It keeps the existing VLA backbone and action expert architecture. [^freqfm]

The starting distribution is still Gaussian. Its coefficient scales follow action spectrum statistics, but it is not already a correct plan for the current task. Guidance is an extra steering term applied during sampling, and its strength depends on frequency.

The paper reports a paired π0.5 improvement on LIBERO-Plus from 66.5% to 75.8%, a gain of **9.3 percentage points**. That does not prove a universal improvement out of distribution, and its own extrapolation results show limitations. [^freqfm]

### Architecture changes and fine-tuning are not opposites

This answers a common question: “Did they change the architecture, or did they fine-tune?”

Those are separate axes.

Changing the **architecture** changes the structure of the network. Changing the **formulation** changes how training examples, objectives, or sampling are constructed. **Fine-tuning** means continuing to train from existing weights.

A method can keep the network architecture, change the flow matching formulation, and fine-tune the weights under that new formulation, all at the same time.

In the same way, “the backbone architecture is unchanged” does not mean “the backbone weights are frozen.” Nor does it mean “the method needs no training.”

## 8. The frequency split moves inside the model

Frequency structure does not have to wait until the final action layer.

**Time-Frequency Geometric Cross-Attention for Chunked Vision-Language-Action Models**, or **TFGCA**, projects hidden action chunk tokens into a control space view, applies learnable stationary wavelets, and feeds the resulting time-frequency information back through cross-attention. It combines dot-product and wedge-product relationships, and it uses an auxiliary alignment objective to ground the projected representation in actions. [^tfgca]

For a beginner, the key point is simpler than the component names. The model does not just transform its final answer. It changes how its intermediate representations share information about the structure of the action.

There is also a useful caution. Applying a transform to arbitrary hidden coordinates does not automatically produce physically meaningful “motion frequencies.” What matters is how those coordinates are organized in time and grounded in actions.

### A map with five levers

We can now organize the field without treating every paper as an unrelated invention:

| Design lever | Question it asks | Examples discussed here |
|---|---|---|
| **Representation** | What coordinates or tokens describe the action? | FAST, FAFM |
| **Architecture** | Which modules handle different scales, and how do they communicate? | Wavelet Policy, CSP, TFGCA |
| **Loss** | Which errors are supervised, weighted, or constrained? | FreqPolicy-FC, FAFM, FreqFM |
| **Generation** | How does the model construct a sample? | FreqPolicy-AR, FreqFM |
| **Execution** | Which commands run, and when should the robot reconsider? | SkiP, FFDC-WAM (discussed below) |

These categories overlap. They are a reading guide, not boxes that each paper must occupy alone. The examples above show that interventions in representation, architecture, and loss already exist, along with several combinations of them. [^fast] [^wavelet-v5] [^csp] [^freq-ar] [^freq-fc] [^fafm] [^freqfm] [^tfgca]

That does not mean the research area is “finished.” It means that adding a DCT, two heads, and a weighted loss is not, by itself, a convincing story of novelty. A new combination needs a new reason to exist.

## 9. The robot also needs to understand what the cup will do

Until now, we have mostly asked how to represent and generate the robot’s commands.

But our failed grasp might have a different cause. Perhaps the robot misjudged the cup’s shape. Perhaps it did not expect that touching the handle would rotate the cup. Perhaps it produced a beautifully structured trajectory toward the wrong future.

This brings us to **world-action models**, or **WAMs**.

A helpful distinction is:

> Frequency-based action modeling asks how to organize the movement.
>
> World modeling asks how the scene will evolve, and how that knowledge should shape the movement.

The distinction is useful, but it is not a rigid boundary in the architecture. A WAM can learn actions and world dynamics jointly, rather than merely supplying a better visual encoder. OpenWAM explicitly studies how generative backbones, representations, action capacity, information flow, and joint training interact. [^openwam]

### Not every world model imagines a full video before acting

It is tempting to picture a WAM as a large video model that first plays a movie of the future and then hands it to a smaller action policy. That is one possible arrangement, not a definition.

**VERA**, introduced in *Turning Video Models into Generalist Robot Policies*, pairs a video planner with inverse dynamics models built for each embodiment. Inverse dynamics asks, “What actions would produce this visual change?” [^vera]

Other methods use more compact or implicit futures. **FLARE: Robot Learning with Implicit World Modeling** aligns policy representations with future latent observations. **GaussianDream** uses a feed-forward 3D Gaussian world representation, trained with reconstruction and prediction, and skips Gaussian decoding when it infers actions. [^flare] [^gaussiandream]

**DELE-w0.5** also studies learning future latent states, but its inference design deserves a close look. In the version examined here, action tokens cannot attend to future observation tokens, and those future tokens are removed at inference. So its title should not be taken as proof of a mandatory “generate the future, then act on it” pipeline. [^dele]

**Fast-WAM** directly examines the difference between predicting video during training and imagining the future at test time. Its controlled experiments suggest that, in its setup, a policy can keep the benefits of video co-training while skipping explicit future video generation at inference. This is not a theorem that explicit imagination never helps. [^fastwam]

Taken together, these examples show why both “a WAM is just a large teacher” and “a WAM only improves the front half of the policy” are too narrow.

Still, a modular combination is easy to imagine:

```text
Images + instruction
         │
         ▼
World-informed representation
         │
         ▼
Frequency-structured action generator
         │
         ▼
Inverse transform → Robot commands
```

The interesting question is no longer whether these boxes can be connected. They can. The interesting question is **what relationship between world information and action structure justifies connecting them in a particular way**.

## 10. A beautiful plan still has to survive execution

Before proposing such a relationship, we need one more complication.

A demonstrated trajectory passes through states like these:

```text
Correct approach → Correct contact → Stable grasp → Successful lift
```

A deployed policy might instead produce:

```text
Slightly wrong approach → Cup shifts → Unfamiliar contact → Failed grasp
```

The policy’s own error changes what it sees next. That next observation may look less like the training data, which leads to another error. This is **rollout distribution shift** and **compounding error**, a central problem in imitation learning. DAgger is a classic answer. It collects supervision on the states the learned policy actually visits. [^dagger]

A spectral method may improve local action predictions. It does not automatically teach the robot how to recover after it has pushed the cup into an unfamiliar position.

A smooth wrong action is still wrong.

### Execution is a different design lever

**SkiP: When to Skip and When to Refine for Efficient Robot Manipulation** analyzes the motion spectrum to separate stretches that can be skipped from stretches that need refinement, and it relabels action targets toward later key segments. Its focus is an efficient execution structure, not merely a different action loss. [^skip]

**FFDC-WAM**, from *When to Trust Imagination: Adaptive Action Execution for World Action Models*, uses a lightweight verifier that compares the real observations with the planned future and decides whether to keep executing or to replan. [^ffdc]

Here lies a terminology trap. A “high-frequency verifier” usually means a verifier that runs often. That is an **update rate**, not necessarily a split of the action signal into DCT bands.

We now have three ideas that must stay separate:

- **Motion frequency:** how quickly the action signal varies over physical time.
- **Generation progress:** how a candidate action is refined internally.
- **Update rate:** how often the policy, the controller, or the verifier runs.

For example, a hypothetical system could replan five times per second, send commands fifty times per second, and take several flow solver steps for every replan. None of these numbers tells us which motion frequencies the predicted chunk contains.

## 11. Where the interesting research questions begin

The field’s progress suggests a better question than “Which two fashionable modules have not been combined yet?”

We can ask: **What information, computation, or supervision does each part of the action genuinely need?**

The directions below are hypotheses worth testing, not confirmed gaps. FreqFM itself lists conditional spectra and WAM extensions as future work, and related methods already connect multiscale action structure with world information or fast feedback. [^freqfm] [^wavelet-v5] [^reactive]

### Direction one: which frequencies need foresight, and which need feedback?

Imagine that a representation of the future tells the robot where the cup should end up, while current vision, joint readings, and touch tell it what is happening right now.

A plausible hypothesis is that the slower parts of an action benefit most from long-horizon world information, while the quick corrective parts benefit most from immediate feedback.

A candidate architecture could therefore look like this:

```text
Future/world features ── Broad-trajectory predictor ──┐
                                                     ├── Reconstructed action
Current sensing ──────── Rapid-correction predictor ───┘
                              ▲
                              │
                   Broad-trajectory context
```

This is more specific than “WAM plus DCT.” It makes a claim about **how information is routed**.

But the routing is not guaranteed to be right. A slow force adjustment may depend on touch. A fast anticipatory motion may depend on prediction. Spectral scale and semantic role do not line up perfectly.

There is also close prior work. **Reactive Diffusion Policy: Slow-Fast Visual-Tactile Policy Learning for Contact-Rich Manipulation** already pairs a slower planning component with fast tactile feedback. It is not the same as an explicit low and high DCT split, but it means we cannot treat the broad idea of foresight plus feedback as new. [^reactive]

A useful experiment would compare restricted routing with giving both branches all the available information. It should also include a time-domain residual architecture of the same capacity. Otherwise, any gain might come from extra capacity or from tactile sensing rather than from the spectral organization.

The contribution would be evidence of when frequency-aware routing helps, not the mere existence of two branches.

### Direction two: can consequences separate useful detail from noise?

Consider two quick corrections in a demonstration. One stabilizes a slipping object. The other is an unnecessary tremor of the operator’s hand.

Could a world model tell them apart by looking at their consequences?

This motivates **cross-modal spectral consistency**, which relates the structure of an action to visual, geometric, or tactile dynamics. But a naive version can be physically wrong.

We should not simply require:

\[
\text{action spectrum}=\text{visual-motion spectrum}.
\]

A simple local linear approximation already shows the problem:

\[
Y(\omega)=H(\omega)U(\omega).
\]

The system response \(H\) can weaken, delay, and shift the phase of the effect that an action \(U\) produces. Equality is not what we should expect.

More concretely, a robot may tighten its grip without visibly moving the object. A contact may be hidden from the camera. Different joints may compensate for one another. A camera may sample too slowly to see rapid changes. And learned visual features do not automatically share the units or the physical meaning of action coefficients.

**An action with no visible effect is not necessarily useless noise.**

A more defensible proposal is to learn a predictor of measurable outcomes, conditioned on the action, and compare its predictions with the outcomes that actually occur. Temporal or spectral consistency can then be enforced between quantities in the **same measurement space**, such as predicted and observed tactile change, rather than between action spectra and image spectra that cannot be compared.

This still does not prove that every detail is necessary. It does create a testable path toward supervision grounded in consequences, with uncertainty and observability handled explicitly.

### Direction three: spend frequency-related computation only when it is needed

Our robot may not need equally detailed generation throughout a task. A long, unobstructed approach and an uncertain contact make very different demands.

A policy could estimate a frequency or scale budget from the current state of the world. It might use a cheaper, coarse representation during predictable motion and switch on extra refinement near contact, uncertainty, or disturbance.

The appealing story is **adaptive spectral computation**: spend effort where it changes the outcome.

However, multiplying high-frequency outputs by zero after they have been computed does not save the work that produced them. Neither does keeping fewer coefficients after a full-size Transformer pass.

To claim efficiency, the mechanism has to skip real work. It can drop branches, reduce tokens, avoid refinement stages, or shorten the solver path. The accounting must include the routing network, the transforms, and the cost of sensing.

There is also a control tradeoff. A budget that waits too long to add detail may miss an unexpected contact. The policy needs a way to revise its decision as fresh feedback arrives.

So the research question is not merely whether the model can predict a gate. It is whether **allocating computation by state improves the measured tradeoff between success and latency without hurting recovery**.

## 12. How to turn a promising story into a useful experiment

The smallest convincing experiment usually asks one clear question.

Suppose the claim is that the task context should decide the action frequency budget. Before training a large world model, we could analyze existing demonstrations, remove selected frequency bands, and see how the reconstructed trajectories and the task outcomes change.

An offline reconstruction score is a starting point, not the final verdict. A trajectory can stay numerically close to the original while losing the one transition that makes the grasp succeed.

Next, keep the backbone, training data, action horizon, and training budget as comparable as possible. An **ablation**, a controlled version with one ingredient removed, can then show what actually produces the improvement.

For example, a time-domain baseline, a DCT baseline with an unchanged loss, a weighted-loss variant, and a structured two-branch variant each answer a different question. If the DCT-only version uses mathematically the same loss, any improvement may come from the parameterization or the optimization rather than from a new supervision signal.

Several practical details can otherwise lead to misleading conclusions.

**Sampling and normalization matter.** A frequency index only has meaning relative to the sampling interval and the horizon. Mixing meters, radians, and gripper commands without care can make comparisons of spectral energy misleading. Spectrum statistics should come from the training data, not from held-out evaluation trajectories.

**Representation boundaries matter.** An angle that wraps around can look like a sudden jump. Gripper transitions may not benefit from the same smoothing as arm motion. Chunks generated independently can have jumps at their boundaries even when each chunk looks smooth inside.

**Deployment measurements matter.** Report closed-loop success, recovery from disturbances, and the relevant timing or contact errors, not only MSE. For efficiency claims, measure real latency, including tail latency and added overhead, instead of assuming that fewer coefficients mean a faster system. Multiple runs or seeds help separate repeatable gains from noise.

Finally, check whether the claimed advantage survives a simpler explanation. Did it come from more parameters? A stronger visual encoder? More training? Access to touch? A shorter horizon?

A good research story grows stronger, not weaker, when it survives these questions.

## 13. Back to the cup

We began with a robot whose movement looked almost right.

Frequency-based policies give us a way to look inside that “almost.” They reorganize trajectories into temporal patterns, which opens the door to compression, specialization, better-weighted supervision, structured generation, and selective computation.

The field has not developed in a single straight line. FAST focuses on the action vocabulary. Wavelet methods explore scale and location. One FreqPolicy builds actions progressively, while the other uses frequency consistency inside a flow-based generator. CSP makes coarse-to-fine conditioning explicit. FAFM and FreqFM redesign parts of continuous generation. TFGCA brings time-frequency structure into the model’s intermediate computation. Execution methods ask when a generated plan still deserves trust.

World-action modeling adds another perspective. A well-organized action should also reflect what the world is likely to do next, and feedback closes the loop when that prediction is wrong.

The lasting idea is not that high frequencies are always precious, that low frequencies always carry meaning, or that a Fourier transform automatically makes a policy intelligent.

It is that **different parts of a movement may deserve different representations, information, supervision, and computation, and that each of these choices should be justified by its consequences in the world**.

The robot does not succeed because its frequency spectrum looks elegant.

It succeeds because its fingers arrive at the right place, close at the right time, and respond when the cup does something unexpected.

---

## References and version notes

[^dct]: SciPy documentation, [`scipy.fft.dct`](https://docs.scipy.org/doc/scipy/reference/generated/scipy.fft.dct.html). See the definitions and normalization conventions for orthonormal DCTs.

[^diffusion]: *Diffusion Policy: Visuomotor Policy Learning via Action Diffusion*. [arXiv:2303.04137](https://arxiv.org/abs/2303.04137).

[^flow]: *Flow Matching for Generative Modeling*. [arXiv:2210.02747](https://arxiv.org/abs/2210.02747).

[^dagger]: *A Reduction of Imitation Learning and Structured Prediction to No-Regret Online Learning*. [arXiv:1011.0686](https://arxiv.org/abs/1011.0686).

[^fast]: *FAST: Efficient Action Tokenization for Vision-Language-Action Models*. [arXiv:2501.09747](https://arxiv.org/abs/2501.09747). First submitted January 2025.

[^wavelet-v1]: *Wavelet Policy: Imitation Policy Learning in Frequency Domain with Wavelet Transforms*. [arXiv:2504.04991v1](https://arxiv.org/abs/2504.04991v1), April 2025. This reference supports the description of the original architecture.

[^wavelet-v5]: *Wavelet Policy: Imitation Learning in the Scale Domain with World Prior Memory*. [arXiv:2504.04991v5](https://arxiv.org/abs/2504.04991v5), June 2026. Substantially revised from the original version.

[^freq-ar]: *FreqPolicy: Frequency Autoregressive Visuomotor Policy with Continuous Tokens*. [arXiv:2506.01583](https://arxiv.org/abs/2506.01583). NeurIPS 2025. The label “FreqPolicy-AR” is used only to tell the two FreqPolicy papers apart in this article. The noise comparison refers to the reported six-task results, not a universal guarantee of robustness.

[^freq-fc]: *FreqPolicy: Efficient Flow-based Visuomotor Policy via Frequency Consistency*. [arXiv:2506.08822](https://arxiv.org/abs/2506.08822). NeurIPS 2025. The label “FreqPolicy-FC” is used only to tell the two FreqPolicy papers apart in this article.

[^csp]: *Hierarchical Policy Learning via Spectral Decomposition*. [arXiv:2606.29570v1](https://arxiv.org/abs/2606.29570v1), June 2026. Causal Spectral Policy (CSP) is the method introduced in this paper. The approximate 30% and 90% relationship is an empirical benchmark observation.

[^fafm]: *Frequency-Aware Flow Matching for Continuous and Consistent Robotic Action Generation*. [arXiv:2606.20135](https://arxiv.org/abs/2606.20135), June 2026.

[^freqfm]: *Frequency-Conditioned Flow Matching for Vision-Language-Action Models*. [arXiv:2609.10405v1](https://arxiv.org/abs/2609.10405v1), September 2026. The result from 66.5% to 75.8% refers to the paired π0.5 comparison on LIBERO-Plus.

[^tfgca]: *Time-Frequency Geometric Cross-Attention for Chunked Vision-Language-Action Models*. [arXiv:2609.09925v1](https://arxiv.org/abs/2609.09925v1), September 2026.

[^skip]: *SkiP: When to Skip and When to Refine for Efficient Robot Manipulation*. [arXiv:2605.15536](https://arxiv.org/abs/2605.15536), May 2026.

[^ffdc]: *When to Trust Imagination: Adaptive Action Execution for World Action Models*. [arXiv:2605.06222](https://arxiv.org/abs/2605.06222), May 2026. Introduces FFDC-WAM. Verification frequency here refers to the update rate, not necessarily a spectral decomposition of actions.

[^openwam]: *OpenWAM: An Open, Modular Exploration Towards Systematic World-Action Model Pretraining*. [arXiv:2609.07398](https://arxiv.org/abs/2609.07398), September 2026.

[^vera]: *Turning Video Models into Generalist Robot Policies*. [arXiv:2605.27817](https://arxiv.org/abs/2605.27817), May 2026. Introduces VERA.

[^flare]: *FLARE: Robot Learning with Implicit World Modeling*. [arXiv:2505.15659](https://arxiv.org/abs/2505.15659), May 2025.

[^gaussiandream]: *GaussianDream: A Feed-Forward 3D Gaussian World Model for Robotic Manipulation*. [arXiv:2605.20752](https://arxiv.org/abs/2605.20752), May 2026.

[^dele]: *DELE-w0.5: Inferring Action from Future Latent State for Robotic Manipulation*. [arXiv:2608.22067v4](https://arxiv.org/abs/2608.22067v4). The discussion of attention restrictions and the removal of future tokens follows the inference design described in Section 4.4 of this version.

[^fastwam]: *Fast-WAM: Do World Action Models Need Test-time Future Imagination?* [arXiv:2603.16666](https://arxiv.org/abs/2603.16666), March 2026.

[^reactive]: *Reactive Diffusion Policy: Slow-Fast Visual-Tactile Policy Learning for Contact-Rich Manipulation*. [arXiv:2503.02881](https://arxiv.org/abs/2503.02881), March 2025. Its slow and fast information routing is related to, but not the same as, an explicit factorization into spectral bands.
