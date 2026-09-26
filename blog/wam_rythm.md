---
title: The Rhythm of a Robot
subtitle: A Beginner’s Journey Through Frequency-Based Policies, Flow Matching, and World–Action Models
date: 2026-09-26
description: An accessible guide to frequency-based robot policies, flow matching, and world–action models, from motion representations to closed-loop execution.
tags: [Robot Learning, World Models]
lang: en
---

# The Rhythm of a Robot

## 1. A robot reaches for a cup—and almost gets it right

Imagine watching a robot pick up a cup.

Its arm moves smoothly across the table. Its hand reaches the right neighborhood. Everything looks promising. Then the fingers close a little too early, brush against the handle, and push the cup away.

From a distance, the movement was almost perfect. From the cup’s perspective, it was a complete failure.

That contrast gives us a useful starting point. A successful robot action has an overall shape, but it also has timing, corrections, and interactions that may be small in numerical magnitude yet decisive for success. How should a learning system represent all of that?

One answer is to look at the movement as a signal—and listen to its different rhythms.

This is the central idea behind frequency-based robot policies. Understanding it does not require starting with Fourier equations. We can start with something much simpler: a list of numbers.

### From a movement to a list

Suppose we record one joint’s angle at equally spaced moments:

| Time | Joint angle |
|---|---:|
| 0.00 seconds | 10° |
| 0.04 seconds | 15° |
| 0.08 seconds | 22° |

This is a **time-series signal**: a quantity whose value changes over time. “Signal” does not necessarily mean a radio transmission. Temperature, microphone pressure, and a robot joint angle can all be signals.

A robot with seven joints has seven such angle signals. Its commands might instead specify joint velocities, motor torques, an end-effector pose, or gripper opening. The physical interpretation changes, but the time-series viewpoint remains useful.

A **policy** is the system that decides which actions to issue from the information available to it. A **vision–language–action model**, or **VLA**, uses visual observations and a language instruction to produce actions. Some frequency-based policies are VLAs; others are visuomotor policies without language. They belong to a related research neighborhood, but the names are not interchangeable.

Rather than predict just one command, a policy can predict an **action chunk**: a short sequence of future commands. Chunked continuous action generation is central to methods such as Diffusion Policy. [^diffusion]

For example, a hypothetical controller might predict 50 commands for the next second, execute a short prefix, and then look again. If each command has seven numbers, the chunk is a 50-by-7 array:

\[
A\in\mathbb{R}^{H\times d},
\]

where \(H\) is the number of future steps and \(d\) is the action dimension.

In the **time domain**, each row answers: “What should the robot do at this moment?”

Frequency-domain methods reorganize the same information around a different question.

## 2. A trajectory has a rhythm—even when it does not repeat

Think about a recording of a piano chord.

One representation tells us how air pressure changes at every instant. Another tells us which oscillating components combine to make the sound. These are not two different sounds. They are two ways to describe the same sound.

We can make a similar change of coordinates for an action chunk.

Instead of describing a trajectory as “angle at step one, angle at step two, angle at step three,” we describe it as a mixture of slowly and rapidly varying patterns.

A **discrete cosine transform**, or **DCT**, uses cosine-shaped patterns. A **discrete Fourier transform**, or **DFT**, uses sinusoidal components represented with complex coefficients. These transforms do not require the observed robot movement itself to be a repeated dance. A finite, nonrepeating sequence can still be expanded in their basis functions.

For an orthonormal DCT, the bookkeeping is particularly clean:

\[
C=QA,
\qquad
A=Q^\top C.
\]

Here, \(Q\) is a fixed transform matrix, \(A\) contains the time-domain commands, and \(C\) contains their frequency coefficients. The transpose \(Q^\top\) performs the inverse transform. Orthonormal DCT conventions are documented explicitly in standard implementations. [^dct]

The transform acts **along time**, separately for each action dimension. We do not normally pretend that joint one, joint two, and joint three are consecutive moments in a signal.

### What low and high frequency actually mean

A low-frequency basis pattern changes slowly across the chunk. A high-frequency pattern changes more rapidly. The zero-frequency component, often called **DC**, captures a constant offset related to the sequence’s mean.

A coefficient tells us how much of one basis pattern to include. It does **not** tell us what to do at one particular moment.

This distinction matters. The first few frequency coefficients are not the first few robot commands. They help describe the entire chunk at a coarse temporal scale.

For intuition, imagine a trajectory with a slow overall trend plus a tiny rapid wobble:

\[
q(t)=0.2t+0.005\sin(20\pi t),
\]

with time measured in seconds and angle in radians. The second term oscillates ten times per second, but its amplitude is small. We could make that oscillation larger without changing its frequency.

**Frequency measures how quickly something varies, not how large or important it is.**

This immediately corrects a tempting shortcut:

> Low frequency can describe a broad movement trend, and high frequency can describe rapid corrections—but “low frequency means coarse” and “high frequency means precise” are not physical laws.

A very slow insertion can be extremely precise. A rapid swing can be large and crude. A sudden gripper transition may require substantial high-frequency content without being a delicate adjustment.

### Changing coordinates is not yet compression

Keeping all DCT coefficients preserves the original sequence, apart from numerical rounding. Compression enters when we truncate coefficients, quantize their values, or encode them more compactly.

There is a second subtlety: a spectrum is more than a collection of magnitudes. Fourier phase helps determine when components line up; DCT coefficient signs also matter. Two signals with similar spectral magnitudes need not have the same timing.

A robot does not merely need the right ingredients. It needs them to come together at the right moment.

## 3. Most of the drawing may need only a few brushstrokes

Return to the cup.

The arm spends much of its time approaching smoothly. Only a smaller part of the movement may involve abrupt changes or rapid corrections. It is therefore plausible that a relatively small set of low-frequency coefficients could describe much of a demonstrated trajectory’s overall shape.

The paper **Hierarchical Policy Learning via Spectral Decomposition** reports that, in its benchmark analysis, roughly the lowest 30% of DCT coefficients typically account for 90% of the measured spectral energy. This is an empirical observation under the paper’s settings, not a universal constant of robot movement. [^csp]

The word **energy** needs care here. Spectral energy means squared signal magnitude under the chosen representation. It is not automatically the robot’s mechanical energy, and it is certainly not a percentage of task success.

Imagine drawing a key. A few strokes describe its length and outline. A tiny notch may contribute almost nothing to the drawing’s total area, yet determine whether the key opens the lock.

Robot trajectories can have the same asymmetry. A component can be small in a numerical summary and still be critical to contact timing or alignment.

That observation creates two apparently opposing goals: exploit the simplicity of the broad trajectory, but do not erase details that decide the task.

Much of this research area can be understood as different attempts to reconcile those goals.

## 4. The first move: stop spelling out every action independently

An accessible place to enter the modern literature is **FAST: Efficient Action Tokenization for Vision-Language-Action Models**, introduced in January 2025.

FAST applies a DCT to action chunks, quantizes the resulting coefficients, and compresses them into tokens suitable for autoregressive models. Its central concern is an efficient action vocabulary: how to avoid describing highly correlated continuous actions through an unnecessarily cumbersome token sequence. [^fast]

An analogy is the difference between describing a melody one audio sample at a time and describing its musical structure more compactly. The analogy is imperfect, but it captures the motivation: neighboring samples often contain redundancy.

This is primarily a **representation and tokenization** intervention. It does not, by itself, establish that a robot should generate every low-frequency coefficient before every high-frequency coefficient. Nor does it imply that all frequency methods must produce discrete tokens.

### Why wavelets enter the story

DCT basis functions extend across the whole chunk. That is useful for global structure, but consider a sudden contact event near the end of an otherwise smooth movement. We may care not only about which temporal scales are present, but also **where in the sequence** they occur.

Wavelet representations offer a multiscale way to retain temporal localization: roughly, they describe broad structure and details associated with different locations and scales.

The April 2025 version of **Wavelet Policy** explored a shared encoder with multiple frequency-oriented decoders and learnable frequency-domain filtering. A substantially revised June 2026 version, titled **Wavelet Policy: Imitation Learning in the Scale Domain with World Prior Memory**, decomposes horizon-aligned latent action tokens and adds scene-related world-prior memory and adaptation. These versions should not be described as an unchanged method. [^wavelet-v1] [^wavelet-v5]

The larger lesson is that “frequency-based” does not always mean “DCT applied to the final motor commands.” The decomposition can live in an intermediate representation, and different mathematical bases expose different kinds of structure.

## 5. Two specialists are not the same thing as a sequence

At this point, two design ideas can sound almost identical:

> Learn low and high frequencies separately.

> Generate low frequencies first, then add higher frequencies.

They are related, but they answer different questions.

**Separate learning is about division of labor. Progressive generation is about dependency and order.**

Imagine two illustrators working from the same brief. One draws the broad outline; the other draws detail. If they work independently and combine their outputs afterward, that is separation without a required generation order.

A hypothetical policy could do this:

```text
                  ┌── Low-frequency predictor ──┐
Observation ──────┤                              ├── Inverse transform ── Actions
                  └── High-frequency predictor ─┘
```

Now imagine the detail artist first receiving the completed outline. The detail is drawn relative to that outline. That introduces a dependency:

```text
Observation ── Low-frequency prediction
                         │
                         ▼
             High-frequency prediction
                         │
                         ▼
                Reconstructed actions
```

A schematic probabilistic expression is:

\[
p(C_L,C_H\mid o)
=
p(C_L\mid o)\,p(C_H\mid o,C_L).
\]

The second predictor knows which coarse trajectory the first predictor chose. This can matter when several broad motions are possible: the fine corrections appropriate for one approach need not fit another.

### Two papers—and one naming trap

**FreqPolicy: Frequency Autoregressive Visuomotor Policy with Continuous Tokens**, first released in June 2025 and published at NeurIPS 2025, makes coarse-to-fine frequency progression central. It uses frequency-level reconstructions, continuous latent tokens, and diffusion-based generation rather than simply predicting one raw DCT coefficient at a time. [^freq-ar]

For clarity, we will call this paper **FreqPolicy-AR**. That is a label used in this article, not an official renaming.

The June 2026 spectral-decomposition paper introduces **Causal Spectral Policy**, or **CSP**. These are the paper title and method name of the **same work**, not two separate papers. CSP uses separate low- and high-frequency predictors, with the high-frequency prediction conditioned on the coarse result. It therefore combines specialization **and** coarse-to-fine ordering. [^csp]

Consequently, “parallel specialists versus progressive generation” is a useful conceptual distinction, but not an accurate way to claim that CSP is purely parallel while FreqPolicy-AR is sequential.

### The robot is not executing the low frequencies first

This is easy to misunderstand.

Generating a broad trajectory and then refining it is usually an **internal computation** performed before those commands are issued. Low-frequency components contribute across the whole modeled interval; higher-frequency components can refine any part of it.

It does not mean that the physical robot first performs a “low-frequency phase,” pauses, and then performs the missing high frequencies.

The painter finishes the picture before handing it over. The robot receives the reconstructed sequence and executes commands in physical time.

## 6. The loss is the grading rule, not the student

We have spoken about what different modules “learn.” What does learning actually mean?

Suppose the policy predicts a chunk \(\hat A\), while a demonstration provides the target \(A\). A simple squared-error loss is:

\[
\mathcal{L}=\|\hat A-A\|_F^2.
\]

The subscript only says that we sum the squared differences over all entries of the array.

The loss is a score. Backpropagation computes how changing the model’s parameters would change that score. An optimizer then updates the parameters to reduce it.

In the usual setup, **the model’s parameters are learned; the researcher specifies the loss formula**.

Some methods also learn weighting parameters inside an objective. That does not mean the entire concept of a loss materializes automatically. Learned weights need a principled formulation so the system cannot “solve” the problem merely by ignoring difficult targets.

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

This changes the grading rule when \(\lambda\) changes. It does not require two neural networks. One network can receive both losses.

Conversely, two different prediction heads can be trained under a single summed objective. Architecture and supervision are separate design decisions.

### The mathematical catch: a new coordinate system is not a new loss

Let \(Q\) be an orthonormal DCT matrix. Then:

\[
\|\hat A-A\|_F^2
=
\|Q\hat A-QA\|_F^2
=
\|\hat C-C\|_F^2.
\]

This follows because \(Q^\top Q=I\): an orthonormal change of coordinates preserves squared distance.

Therefore, taking the same prediction, transforming both prediction and target, and summing all coefficient errors with identical weights does **not** create a different objective.

Likewise, calling the two parts “low-frequency loss” and “high-frequency loss” changes nothing if we simply add the same terms back together with the same weighting and gradient paths.

Something substantive must change: relative weights, normalization, model factorization, gradient routing, a compressed representation, constraints, or the generation procedure.

This also explains why “time-domain MSE inherently cannot learn high frequencies” is too strong. Depending on the data and current residuals, large-scale errors may dominate optimization. But the coordinates alone do not make squared error mathematically blind to rapid variation.

### Why not just multiply the high-frequency loss by ten?

Because high-frequency detail is not automatically useful detail.

Imagine a demonstration containing a precise corrective motion and an operator’s hand tremor. Both can introduce rapid variation. Increasing the high-frequency weight can reward reproducing both.

There is an additional statistical nuance. Ideal white noise has a flat expected power spectrum. It is not inherently concentrated only at high frequencies. If the useful trajectory is mostly low-frequency, however, high-frequency bands can have worse **signal-to-noise ratio**: less useful motion relative to the noise present there. Slowly varying drift can also contaminate low frequencies.

FreqPolicy-AR reports robustness under noisy demonstrations, but the result should not be inflated into “all baselines fail at noise standard deviation 0.1.” In its reported six-task average at that setting, it achieves 33%, compared with 23% for DP3 and 19% for Mamba. The setting, action normalization, and individual task all matter. [^freq-ar]

The real challenge is not simply “pay more attention to high frequency.” It is “preserve the changes that matter without faithfully imitating corruption.”

## 7. Generating a trajectory from static

So far, we have discussed what the policy predicts and how we grade it. Another question remains: **how is a plausible action sequence generated at all?**

Suppose a bottle blocks the straight path to the cup. Going left and going right may both be valid demonstrations. Averaging the two paths could send the arm directly into the bottle.

This thought experiment illustrates why a policy may need to represent a distribution of possible actions rather than one arithmetic average. Diffusion Policy is an example of learning a conditional action distribution through a denoising process. [^diffusion]

Flow matching gives us a related way to construct continuous generative models.

### Two clocks, not one

Let \(t\) denote physical robot time. Introduce a different variable, \(\tau\), for the generator’s internal progress from noise to an action chunk.

In a basic straight-path construction, take a random starting sample \(X_0\), a demonstrated action chunk \(X_1\), and form:

\[
X_\tau=(1-\tau)X_0+\tau X_1.
\]

A neural network learns a vector field \(v_\theta(X_\tau,\tau,\text{context})\) that points along the transport path. For this simple construction, the target direction is \(X_1-X_0\). At inference, the model starts from a random sample and numerically integrates its learned field toward an action sample. This is the basic flow-matching viewpoint. [^flow]

Here, **velocity means change with respect to generation time \(\tau\)**. It is not necessarily a physical joint velocity. Even if the output commands are joint positions, the generator can still predict a flow velocity over the array of positions.

One internal refinement updates the candidate chunk. One physical control step executes a command. They are different operations on different clocks.

### The other FreqPolicy

There is a second, distinct NeurIPS 2025 paper: **FreqPolicy: Efficient Flow-based Visuomotor Policy via Frequency Consistency**.

We will call it **FreqPolicy-FC**. It introduces frequency-domain consistency between flow-velocity predictions at different generation times, with adaptive frequency weighting, to support efficient generation, including one-step inference. Its key intervention is not the same frequency-level autoregressive procedure used by FreqPolicy-AR. [^freq-fc]

“Spectral consistency” therefore needs a follow-up question: **consistency between what and what?** Between two solver times? Between a prediction and a demonstration? Between overlapping chunks? The phrase alone does not specify a method.

### FAFM: represent the whole curve, including how it changes

**Frequency-Aware Flow Matching for Continuous and Consistent Robotic Action Generation**, or **FAFM**, operates on DCT coefficients and uses a continuous-time action representation. It also supervises the trajectory’s analytic temporal derivative. Its analysis connects this derivative-matching term to frequency-dependent penalties of the form \(1+\lambda\omega_k^2\). [^fafm]

The distinction is important: matching the demonstrated derivative is not the same as penalizing every nonzero derivative. One says, “Change in the appropriate way.” The other says, “Avoid changing.” A useful action can require motion, acceleration, and sharp transitions.

### FreqFM: keep the network, change the transport problem

The September 2026 paper **Frequency-Conditioned Flow Matching for Vision-Language-Action Models**, or **FreqFM**, changes three parts of the flow formulation: a spectrum-matched Gaussian source, a spectrum-aware objective with learned frequency weights, and frequency-wise constraints on sampling guidance. It retains the existing VLA backbone and action-expert architecture. [^freqfm]

The starting distribution is still Gaussian. Its coefficient scales are shaped by action-spectrum statistics; it is not already a correct plan for the current task. Guidance is an extra steering term during sampling, whose strength is controlled by frequency.

The paper reports a paired π0.5 improvement on LIBERO-Plus from 66.5% to 75.8%, or **9.3 percentage points**. That does not establish universal OOD improvement: its reported extrapolation results also show limitations. [^freqfm]

### Architecture changes and fine-tuning are not opposites

This answers a common question: “Did they change the architecture, or did they fine-tune?”

Those are different axes.

Changing the **architecture** changes the network’s structure. Changing the **formulation** changes how training examples, objectives, or sampling are constructed. **Fine-tuning** describes continuing training from existing weights.

A method can keep the network architecture, change the flow-matching formulation, and fine-tune the weights under that formulation—all at once.

Similarly, “the backbone architecture is unchanged” does not mean “the backbone weights are frozen.” Nor does it mean “the method is training-free.”

## 8. The frequency split moves inside the model

Frequency structure need not wait until the last action layer.

**Time–Frequency Geometric Cross-Attention for Chunked Vision–Language–Action Models**, or **TFGCA**, projects hidden action-chunk tokens into a control-space view, applies learnable stationary wavelets, and feeds time–frequency information back through cross-attention. It combines dot-product and wedge-product-based relationships and uses an auxiliary alignment objective to ground the projected representation in actions. [^tfgca]

For a beginner, the key point is simpler than those component names: the model does not merely transform its final answer. It changes how intermediate representations exchange information about action structure.

There is also a useful caution here. Applying a transform to arbitrary hidden coordinates does not automatically create physically meaningful “motion frequencies.” The temporal organization and grounding of those coordinates matter.

### A map with five levers

We can now organize the field without treating every paper as a completely unrelated invention:

| Design lever | Question it asks | Examples discussed here |
|---|---|---|
| **Representation** | What coordinates or tokens describe the action? | FAST; FAFM |
| **Architecture** | Which modules process different scales, and how do they communicate? | Wavelet Policy; CSP; TFGCA |
| **Loss** | Which errors are supervised, weighted, or constrained? | FreqPolicy-FC; FAFM; FreqFM |
| **Generation** | How does the model construct a sample? | FreqPolicy-AR; FreqFM |
| **Execution** | Which commands are executed, and when should the robot reconsider? | SkiP; FFDC-WAM, discussed below |

These categories overlap. They are a reading guide, not separate boxes that papers must occupy exclusively. The examples above establish that representation, architecture, and loss interventions—and several combinations—already exist. [^fast] [^wavelet-v5] [^csp] [^freq-ar] [^freq-fc] [^fafm] [^freqfm] [^tfgca]

That does not mean the research area is “finished.” It means that adding DCT, two heads, and a weighted loss is not, by itself, a convincing explanation of novelty. A new combination needs a new reason to exist.

## 9. The robot also needs to understand what the cup will do

Up to now, we have mostly asked how to represent and generate the robot’s commands.

But our failed grasp might have another cause. Perhaps the robot misjudged the cup’s geometry. Perhaps it did not anticipate that touching the handle would rotate the cup. Perhaps it generated a beautifully structured trajectory toward the wrong future.

This brings us to **world–action models**, or **WAMs**.

A helpful distinction is:

> Frequency-based action modeling asks how to organize the movement.
>
> World modeling asks how the scene evolves—and how that knowledge should inform movement.

The distinction is useful, but not a rigid architectural boundary. A WAM can jointly learn actions and world evolution, not merely provide a better visual encoder. OpenWAM explicitly studies the interaction among generative backbones, representations, action capacity, information flow, and joint training. [^openwam]

### Not every world model imagines a full video before acting

It is tempting to picture a WAM as a large video model that first plays a future movie and then hands it to a smaller action policy. That is one possible arrangement, not a definition.

**VERA**, introduced in *Turning Video Models into Generalist Robot Policies*, combines a video planner with embodiment-specific inverse-dynamics models. Here, inverse dynamics asks: “What actions would produce the desired visual transition?” [^vera]

Other methods use more compact or implicit futures. **FLARE: Robot Learning with Implicit World Modeling** aligns policy representations with future latent observations. **GaussianDream** uses a feed-forward 3D Gaussian world representation with reconstruction and prediction training, while avoiding Gaussian decoding during action inference. [^flare] [^gaussiandream]

**DELE-w0.5** also studies future latent-state learning, but its detailed inference design deserves attention: the examined version prevents action tokens from attending to future-observation tokens and removes those future tokens at inference. Its title should therefore not be read as proof of a mandatory “generate future, then consume it to act” pipeline. [^dele]

**Fast-WAM** directly investigates the distinction between training-time video prediction and test-time future imagination. Its controlled experiments support retaining benefits from video co-training while avoiding explicit future-video generation at inference in its proposed setup. This is not a theorem that explicit imagination can never help. [^fastwam]

Taken together, these examples show why “WAM means a large teacher” and “WAM only improves the front half of the policy” are both too narrow.

Nevertheless, a modular combination remains easy to imagine:

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

Before proposing that relationship, we need one more complication.

A demonstrated trajectory visits states like:

```text
Correct approach → Correct contact → Stable grasp → Successful lift
```

A deployed policy might instead produce:

```text
Slightly wrong approach → Cup shifts → Unfamiliar contact → Failed grasp
```

Its own action error changes what it sees next. The next observation may then be less like the training data, leading to another error. This is **rollout distribution shift** and **compounding error**, a central issue in imitation learning. DAgger is a classic example of addressing the mismatch by collecting supervision on states visited by the learned policy. [^dagger]

A spectral method may improve local action predictions. It does not automatically teach the robot how to recover after it pushes the cup into an unfamiliar position.

A smooth wrong action is still wrong.

### Execution is a different design lever

**SkiP: When to Skip and When to Refine for Efficient Robot Manipulation** uses motion-spectrum-based analysis to distinguish regions where motion can be skipped from regions requiring refinement, including relabeling action targets toward later key segments. Its emphasis is efficient execution structure, not merely a different action loss. [^skip]

**FFDC-WAM**, from *When to Trust Imagination: Adaptive Action Execution for World Action Models*, uses a lightweight verifier to compare evolving real observations with planned futures and decide whether to continue execution or replan. [^ffdc]

Here is a terminology trap: a “high-frequency verifier” usually means a verifier that runs often. That is an **update rate**, not necessarily a decomposition of action signals into DCT bands.

We now have three concepts that must stay separate:

- **Motion frequency:** how quickly the action signal varies over physical time.
- **Generation progress:** how a candidate action is refined internally.
- **Update rate:** how often the policy, controller, or verifier runs.

For example, a hypothetical system could replan five times per second, execute commands fifty times per second, and use several flow-solver steps for every replan. None of those numbers alone tells us which motion frequencies the predicted chunk contains.

## 11. Where the interesting research questions begin

The field’s development gives us a better question than “Which two fashionable modules have not been combined?”

We can ask: **What information, computation, or supervision does a particular part of the action genuinely need?**

The following directions are hypotheses worth testing. They are not verified empty territories. FreqFM itself names conditional spectra and WAM extensions as future directions, and related methods already connect multiscale action structure with world information or fast feedback. [^freqfm] [^wavelet-v5] [^reactive]

### Direction one: which frequencies need foresight, and which need feedback?

Imagine that a future representation tells the robot where the cup should end up. Current vision, joint measurements, and tactile readings tell it what is happening right now.

A plausible hypothesis is that slower action components benefit strongly from longer-horizon world information, while rapid corrective components benefit strongly from immediate feedback.

A candidate architecture could therefore use:

```text
Future/world features ── Broad-trajectory predictor ──┐
                                                     ├── Reconstructed action
Current sensing ──────── Rapid-correction predictor ───┘
                              ▲
                              │
                   Broad-trajectory context
```

This is more specific than “WAM plus DCT.” It makes a claim about **information routing**.

But the routing is not guaranteed to be correct. A slow force adjustment may depend on tactile feedback. A rapid anticipatory motion may require prediction. Spectral scale and semantic role do not line up perfectly.

There is also nearby prior work. **Reactive Diffusion Policy: Slow-Fast Visual-Tactile Policy Learning for Contact-Rich Manipulation** already combines a slower planning component with fast tactile feedback. It is not the same as an explicit low/high DCT split, but it prevents us from treating the broad foresight-plus-feedback idea as new. [^reactive]

A useful experiment would compare restricted routing against giving both branches all available information. It should also compare a same-capacity time-domain residual architecture. Otherwise, a gain could come from extra capacity or tactile sensing rather than spectral organization.

The contribution would be evidence for when frequency-aware routing helps—not the mere existence of two branches.

### Direction two: can consequences distinguish useful detail from noise?

Consider two rapid corrections in a demonstration. One stabilizes a slipping object. The other is an unnecessary operator tremor.

Could a world model help tell them apart by examining their consequences?

This motivates **cross-modal spectral consistency**: relating action structure to visual, geometric, or tactile dynamics. But a naive formulation can be physically wrong.

We should not simply require:

\[
\text{action spectrum}=\text{visual-motion spectrum}.
\]

A simple local linear approximation already shows the problem:

\[
Y(\omega)=H(\omega)U(\omega).
\]

The system response \(H\) can attenuate, delay, and shift the phase of the effect produced by an action \(U\). Equality is not the expected relationship.

More concretely, a robot may adjust grip force without visibly moving the object. A contact may be occluded. Different joints may compensate for one another. A camera may sample too slowly to observe rapid changes. Learned visual features also do not automatically share the units or physical meaning of action coefficients.

**No visible movement does not imply that an action is useless noise.**

A more defensible proposal is to learn an action-conditioned predictor of measurable outcomes and compare its predicted outcomes with actual outcomes. Temporal or spectral consistency can then be imposed between quantities in the **same measurement space**—predicted versus observed tactile change, for example—rather than between incomparable action and image spectra.

That still does not prove that every detail is necessary. It creates a testable route toward consequence-grounded supervision, with uncertainty and observability treated explicitly.

### Direction three: spend frequency-related computation when it is needed

Our robot may not need equally detailed generation throughout a task. A long unobstructed approach and an uncertain contact event present different demands.

A policy could estimate a frequency or scale budget from the current world state. It might use a cheaper coarse representation during predictable motion, then activate additional refinement near contact, uncertainty, or disturbance.

The attractive story is **adaptive spectral computation**: spend effort where it changes the outcome.

However, multiplying already-computed high-frequency outputs by zero does not save the computation that produced them. Neither does selecting fewer coefficients after a full-sized Transformer pass.

To claim efficiency, the mechanism must actually skip work: omit branches, reduce tokens, avoid refinement stages, or shorten a solver path. The accounting must include the routing network, transforms, and sensing overhead.

There is also a control tradeoff. A budget that waits too long to activate detail may miss an unexpected contact. The policy needs a way to revise its decision from fresh feedback.

The research question is therefore not merely whether the model can predict a gate. It is whether **state-conditioned allocation improves the measured success–latency tradeoff without sacrificing recovery**.

## 12. How to turn a promising story into a useful experiment

The smallest convincing experiment usually asks one clear question.

Suppose the claim is that task context should determine the action-frequency budget. Before training a large world model, we could analyze existing demonstrations, remove selected bands, and examine how reconstructed trajectories and task outcomes change.

An offline reconstruction score is a starting point, not the final judge. A trajectory can remain numerically close while losing the transition that makes a grasp succeed.

Next, keep the backbone, training data, action horizon, and training budget as comparable as possible. An **ablation**—a controlled version with one ingredient removed—can then test what actually produces the improvement.

For example, a time-domain baseline, an unchanged-loss DCT baseline, a weighted-loss variant, and a structured two-branch variant answer different questions. If the DCT-only version has the same mathematical loss, improvements may reflect parameterization or optimization rather than a new supervision signal.

Several practical details can otherwise create misleading conclusions.

**Sampling and normalization matter.** A frequency index has meaning only relative to the sampling interval and horizon. Mixing meters, radians, and gripper commands without appropriate treatment can make spectral energy comparisons misleading. Spectrum statistics should be estimated from training data, not from held-out evaluation trajectories.

**Representation boundaries matter.** Angle wraparound can look like a sudden jump. Gripper transitions may not benefit from the same smoothing as arm motion. Independently generated chunks can have boundary discontinuities even when each chunk looks smooth internally.

**Deployment measurements matter.** Report closed-loop success, recovery from disturbances, and relevant timing or contact errors—not only MSE. For efficiency claims, measure actual latency, including tail latency and added overhead, rather than equating fewer coefficients with a faster system. Multiple runs or seeds help distinguish repeatable gains from variation.

Finally, examine whether the claimed advantage survives a simpler explanation. Did it come from more parameters? A stronger visual encoder? More training? Access to tactile sensing? A shorter horizon?

A good research story becomes stronger, not weaker, when it survives these questions.

## 13. Back to the cup

We began with a robot whose movement looked almost right.

Frequency-based policies offer a way to look inside that “almost.” They reorganize trajectories into temporal patterns, creating opportunities for compression, specialization, better-weighted supervision, structured generation, and selective computation.

The development is not a single straight line. FAST emphasizes the action vocabulary. Wavelet methods explore scale and localization. One FreqPolicy builds actions progressively, while another uses frequency consistency in a flow-based generator. CSP makes coarse-to-fine conditioning explicit. FAFM and FreqFM redesign aspects of continuous generation. TFGCA brings time–frequency structure into intermediate computation. Execution methods ask when a generated plan should still be trusted.

World–action modeling adds another perspective: a well-organized action should also reflect what the world is likely to do. Feedback closes the loop when that prediction is wrong.

The lasting idea is not that high frequencies are always precious, low frequencies are always semantic, or a Fourier transform automatically makes a policy intelligent.

It is that **different parts of a movement may deserve different representations, information, supervision, and computation—and those choices should be justified by their consequences in the world**.

The robot does not succeed because its frequency spectrum looks elegant.

It succeeds because the fingers arrive at the right place, close at the right time, and respond when the cup does something unexpected.

---

## References and version notes

[^dct]: SciPy documentation, [`scipy.fft.dct`](https://docs.scipy.org/doc/scipy/reference/generated/scipy.fft.dct.html). See the definitions and normalization conventions for orthonormal DCTs.

[^diffusion]: *Diffusion Policy: Visuomotor Policy Learning via Action Diffusion*. [arXiv:2303.04137](https://arxiv.org/abs/2303.04137).

[^flow]: *Flow Matching for Generative Modeling*. [arXiv:2210.02747](https://arxiv.org/abs/2210.02747).

[^dagger]: *A Reduction of Imitation Learning and Structured Prediction to No-Regret Online Learning*. [arXiv:1011.0686](https://arxiv.org/abs/1011.0686).

[^fast]: *FAST: Efficient Action Tokenization for Vision-Language-Action Models*. [arXiv:2501.09747](https://arxiv.org/abs/2501.09747). First submitted January 2025.

[^wavelet-v1]: *Wavelet Policy: Imitation Policy Learning in Frequency Domain with Wavelet Transforms*. [arXiv:2504.04991v1](https://arxiv.org/abs/2504.04991v1), April 2025. This reference supports the description of the original architecture.

[^wavelet-v5]: *Wavelet Policy: Imitation Learning in the Scale Domain with World Prior Memory*. [arXiv:2504.04991v5](https://arxiv.org/abs/2504.04991v5), June 2026. Substantially revised from the original version.

[^freq-ar]: *FreqPolicy: Frequency Autoregressive Visuomotor Policy with Continuous Tokens*. [arXiv:2506.01583](https://arxiv.org/abs/2506.01583); NeurIPS 2025. The label “FreqPolicy-AR” is used only for disambiguation in this article. The noise comparison refers to the reported six-task results, not a universal robustness guarantee.

[^freq-fc]: *FreqPolicy: Efficient Flow-based Visuomotor Policy via Frequency Consistency*. [arXiv:2506.08822](https://arxiv.org/abs/2506.08822); NeurIPS 2025. The label “FreqPolicy-FC” is used only for disambiguation in this article.

[^csp]: *Hierarchical Policy Learning via Spectral Decomposition*. [arXiv:2606.29570v1](https://arxiv.org/abs/2606.29570v1), June 2026. Causal Spectral Policy (CSP) is the method introduced in this paper. The approximate 30%/90% relationship is an empirical benchmark observation.

[^fafm]: *Frequency-Aware Flow Matching for Continuous and Consistent Robotic Action Generation*. [arXiv:2606.20135](https://arxiv.org/abs/2606.20135), June 2026.

[^freqfm]: *Frequency-Conditioned Flow Matching for Vision-Language-Action Models*. [arXiv:2609.10405v1](https://arxiv.org/abs/2609.10405v1), September 2026. The 66.5% to 75.8% result refers to the paired π0.5 comparison on LIBERO-Plus.

[^tfgca]: *Time–Frequency Geometric Cross-Attention for Chunked Vision–Language–Action Models*. [arXiv:2609.09925v1](https://arxiv.org/abs/2609.09925v1), September 2026.

[^skip]: *SkiP: When to Skip and When to Refine for Efficient Robot Manipulation*. [arXiv:2605.15536](https://arxiv.org/abs/2605.15536), May 2026.

[^ffdc]: *When to Trust Imagination: Adaptive Action Execution for World Action Models*. [arXiv:2605.06222](https://arxiv.org/abs/2605.06222), May 2026. Introduces FFDC-WAM; verification frequency here concerns update rate, not necessarily spectral decomposition of actions.

[^openwam]: *OpenWAM: An Open, Modular Exploration Towards Systematic World-Action Model Pretraining*. [arXiv:2609.07398](https://arxiv.org/abs/2609.07398), September 2026.

[^vera]: *Turning Video Models into Generalist Robot Policies*. [arXiv:2605.27817](https://arxiv.org/abs/2605.27817), May 2026. Introduces VERA.

[^flare]: *FLARE: Robot Learning with Implicit World Modeling*. [arXiv:2505.15659](https://arxiv.org/abs/2505.15659), May 2025.

[^gaussiandream]: *GaussianDream: A Feed-Forward 3D Gaussian World Model for Robotic Manipulation*. [arXiv:2605.20752](https://arxiv.org/abs/2605.20752), May 2026.

[^dele]: *DELE-w0.5: Inferring Action from Future Latent State for Robotic Manipulation*. [arXiv:2608.22067v4](https://arxiv.org/abs/2608.22067v4). The discussion of attention restrictions and removal of future tokens is based on the detailed inference design in Section 4.4 of this version.

[^fastwam]: *Fast-WAM: Do World Action Models Need Test-time Future Imagination?* [arXiv:2603.16666](https://arxiv.org/abs/2603.16666), March 2026.

[^reactive]: *Reactive Diffusion Policy: Slow-Fast Visual-Tactile Policy Learning for Contact-Rich Manipulation*. [arXiv:2503.02881](https://arxiv.org/abs/2503.02881), March 2025. Related slow–fast information routing is not identical to explicit spectral-band factorization.
