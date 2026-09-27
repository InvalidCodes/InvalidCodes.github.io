---
title: What Should a Robot Remember About the World?
subtitle: From VAE Latents to JEPA Based World Action Models
date: 2026-09-24
description: Many world action models inherit a VAE latent from video generation. This post asks what a robot's world state should actually keep, and follows the shift toward JEPA representations shaped by prediction and control.
tags: [Robot Learning, WAM]
lang: en
---

# What Should a Robot Remember About the World?

## 1. The cup barely moved, but the representation changed

Imagine a robot looking at a cup on a table. Between two camera frames, three very different things could happen.

The room light becomes slightly brighter. The cup does not move at all.

The camera shifts by a few pixels. The physical scene is almost unchanged.

The cup rotates by five degrees because the gripper touched it.

For robot control, these changes should not be treated equally. The first two are often nuisance variation. The third can matter enormously because it changes the object pose and therefore the next useful action.

This is where a large part of the current debate around World Action Models, or WAMs, begins. A WAM needs some internal representation of the current world. It then uses that representation to help predict actions, future states, or both. The difficult question is not merely how large the world model should be. It is more basic:

**What information should count as the state of the world?**

Many WAMs inherit a variational autoencoder, or VAE, from pretrained video generation models. That is convenient, but it also means that the robot starts from a representation designed for visual reconstruction. Recent work asks whether a predictive representation such as JEPA might be a better foundation for control. [^robust-wam] [^jepa-wam-latent] [^lewam]

To understand why this question matters, we first need to understand what a VAE actually does.

## 2. A VAE is a machine for compressing and reconstructing observations

Start with a normal autoencoder.

An image \(x\) may contain hundreds of thousands of pixel values. An encoder compresses it into a smaller latent representation \(z\):

\[
z = E(x).
\]

A decoder tries to reconstruct the original image:

\[
\hat{x} = D(z).
\]

Training encourages \(\hat{x}\) to resemble \(x\). The latent therefore has to preserve enough information for the decoder to recover the important visual content.

A variational autoencoder adds a probabilistic structure. Instead of mapping the image to one deterministic latent vector, the encoder predicts parameters of a latent distribution, commonly a mean \(\mu\) and a scale \(\sigma\). A sample can then be written as

\[
z = \mu + \sigma \epsilon,
\qquad
\epsilon \sim \mathcal{N}(0,I).
\]

The original VAE formulation combines a data reconstruction term with a regularization term that keeps the approximate latent distribution close to a chosen prior. The reparameterization above makes this stochastic latent trainable with ordinary gradient based optimization. [^vae]

For the present discussion, the most important fact is simpler than the full variational derivation:

**A VAE is trained so that its latent remains useful for reconstructing the observation.**

That objective explains why VAE latents are attractive for image and video generation. A generation model does not need to manipulate every RGB value directly. It can operate in a smaller latent space, then let a decoder turn the generated latent back into pixels. Latent Diffusion Models popularized this pattern for high resolution image synthesis by running the expensive generative process inside a pretrained autoencoder latent space. [^ldm]

A simplified pipeline looks like this:

```text
RGB image or video
        ↓
    VAE encoder
        ↓
 compressed latent
        ↓
 generative backbone
        ↓
 generated latent
        ↓
    VAE decoder
        ↓
 RGB image or video
```

This design is computationally attractive because the large generative backbone works on a compressed representation instead of the full pixel grid.

## 3. WAMs use VAE latents mostly because video models already do

A common misunderstanding is that the definition of a WAM requires a VAE.

It does not.

The historical reason is more practical. Many WAMs are built by adapting pretrained video generation models to robotic control. Those video models already contain a visual compressor and a large generative backbone. If the pretrained model operates in VAE space, the easiest way to reuse its learned dynamics is to keep that space. Robust-WAM describes this mainstream pattern directly: observations are encoded into VAE latents, then a pretrained video generation backbone processes those latents while the system learns robot actions. [^robust-wam]

The inheritance chain is therefore approximately

```text
pretrained video generator
        ↓
VAE latent representation
        ↓
video dynamics backbone
        ↓
adapted World Action Model
```

This matters because the backbone has learned the statistics of one particular representation space.

Suppose a pretrained video model learned a function

\[
F_{\theta}(z_t^{\mathrm{VAE}}) \rightarrow z_{t+1}^{\mathrm{VAE}}.
\]

Now imagine replacing the encoder with JEPA and feeding it

\[
z_t^{\mathrm{JEPA}}.
\]

Even if the two tensors have the same numerical shape, their coordinates do not mean the same thing. One might encode texture, local color, and reconstruction detail. The other might organize features around predictable semantic and temporal structure.

The old backbone has never learned the dynamics of the new space.

This is similar to training a language model with one tokenizer, then silently replacing that tokenizer with another vocabulary whose embeddings have the same dimension. Matching tensor shapes does not make the representations interchangeable.

So JEPA cannot usually be inserted into an existing VAE based WAM as a drop in encoder while every other pretrained component remains untouched.

Changing the encoder changes the state space in which the world model operates.

## 4. The real criticism of VAE latents is about objective mismatch

The strongest criticism is not simply that VAE features can change when the image changes. A robot representation should change when the world changes.

The deeper question is whether the latent geometry matches the distinctions that matter for control.

A reconstruction oriented latent is rewarded for preserving information that helps reproduce pixels. Lighting, surface texture, shadows, and background appearance can all matter to reconstruction even when they are irrelevant to the next robot action.

Robust-WAM makes this mismatch explicit. It argues that VAE spaces used by video generation models retain detailed appearance information because they are optimized for visual reconstruction. Under visual distribution shifts such as illumination changes, this can make action prediction fragile. The paper therefore keeps the pretrained VAE generation path while adding semantic foresight supervision to the action stream. [^robust-wam]

### Sensitivity to rotation is not automatically a flaw

There is an important correction to the common statement that a useful representation should be invariant to rotation.

Suppose the cup rotates by thirty degrees. If the robot representation remains exactly unchanged, the controller may lose information that is essential for grasping.

For many physical transformations, what we actually want is closer to **equivariance** than invariance.

If \(R\) denotes a physical rotation, a useful representation might obey a structured relationship of the form

\[
E(Rx) \approx \rho(R)E(x),
\]

where \(\rho(R)\) is a predictable transformation in latent space.

The representation is allowed to change. The desirable property is that the change reflects the physical transformation in a stable and usable way.

This gives a more precise criticism of a generic reconstruction latent. The problem is not that it notices rotation. The problem is that it was not necessarily trained to organize rotation, viewpoint change, contact geometry, and object motion into the coordinate system that a controller would find easiest to model.

A physically simple event can therefore become a complicated trajectory in latent space.

The world model then has to learn both the environment dynamics and the idiosyncrasies of the representation.

### Frame spacing creates a second problem

Now consider time.

Suppose the training data usually pairs frames separated by \(\Delta t = 33\) milliseconds. The object displacement between neighboring frames may be small. If deployment effectively exposes the model to a longer temporal gap, the same physical velocity produces a larger visual displacement.

The transition is really a function of time scale:

\[
F(z_t, a_t, \Delta t) \rightarrow z_{t+\Delta t}.
\]

A model trained only around one frame rate or one temporal stride can become sensitive to this discretization.

This is not a VAE specific defect. A JEPA representation can also suffer if transition learning silently assumes one fixed \(\Delta t\). Randomized temporal stride, explicit time conditioning, or objectives that cover multiple horizons are separate design choices.

JEPA may improve the representation problem without automatically solving the time discretization problem.

## 5. JEPA asks a different question from a VAE

The conceptual shift in JEPA is easiest to see by comparing the training questions.

A reconstruction model asks:

> What information must I preserve so that I can reproduce the observation?

A Joint Embedding Predictive Architecture asks something closer to:

> What representation of one observation helps predict the representation of another related observation?

Instead of requiring a decoder to reconstruct every pixel, a JEPA style model predicts in representation space.

A simplified pattern is

```text
context observation
        ↓
      encoder
        ↓
context representation
        ↓
     predictor
        ↓
predicted target representation
```

The target itself is another learned representation rather than the raw RGB image.

This gives the model permission to ignore aspects of the pixels that are difficult to predict and irrelevant to the predictive task. In principle, illumination noise or tiny texture changes can matter less than object identity, motion, pose, and temporal relations.

V-JEPA 2 shows how far this idea can be pushed. It first learns video representations from over one million hours of video and images. It then post trains an action conditioned latent world model using less than 62 hours of robot video, and uses that latent model for robot planning without decoding future RGB frames. [^vjepa2]

The important lesson is not that JEPA magically discovers the perfect robot state. It is that world modeling does not have to happen in a pixel reconstruction latent.

### JEPA can also throw away too much

Predictive abstraction has its own danger.

For high level video understanding, two frames may be semantically almost identical even if a fingertip moved by two millimeters. For dexterous manipulation, that same two millimeter shift can decide whether contact is stable.

A useful robot state therefore has to perform a difficult balancing act. It should suppress nuisance variation such as lighting while preserving control relevant details such as pose, contact location, object motion, and fine hand geometry.

The ideal representation is not simply more semantic.

It is **selectively invariant and physically informative**.

## 6. JEPA-WAM does more than replace the encoder

The 2026 paper *JEPA-WAM: Learning Vision-Language-Action Policies with Joint-Embedding World Modeling* provides a concrete example of how to build a WAM in JEPA space. Its key idea is not to attach a JEPA encoder to an unchanged video diffusion model. It redesigns the predictive target and couples that target to the same backbone used for action generation. [^jepa-wam-latent]

### Step one: encode the current scene with frozen V-JEPA features

Instead of producing a VAE reconstruction latent, the system uses a pretrained frozen V-JEPA 2.1 encoder to extract dense visual tokens from the current camera observations.

For view \(v\), we can write this schematically as

\[
Z_t = \operatorname{Concat}_{v \in V} E_J(O_t^v).
\]

The important word is **dense**. The representation keeps patch level spatial correspondence rather than collapsing the entire scene into one semantic vector. [^jepa-wam-latent]

That matters because a robot needs more than the statement that a cup exists. It needs information about where the cup is, how it relates to the gripper, and which parts of the scene moved.

### Step two: define a latent target that contains the transition

During training, the method also looks at a future observation \(O_{t+\delta}\).

For each camera, the current and future frames are stacked in time and jointly encoded by the frozen V-JEPA encoder. The resulting target can be summarized as

\[
Y_{t,t+\delta}
=
\operatorname{Concat}_{v \in V}
\operatorname{sg}
\left[
E_J\left(\operatorname{Stack}_{\mathrm{time}}(O_t^v,O_{t+\delta}^v)\right)
\right],
\]

where \(\operatorname{sg}\) means stop gradient. [^jepa-wam-latent]

The target is not simply a decoded future picture. It is a structured representation of the current and future pair.

This lets the learning signal emphasize temporal relations while preserving spatial patch structure.

### Step three: let one predictor serve both world learning and action learning

The current JEPA tokens are projected into the hidden dimension of a shared predictor. In the reported JEPA-WAM implementation, this predictor is based on Qwen2.5 0.5B. The sequence includes visual tokens, language instruction tokens, and dedicated action placeholder tokens. [^jepa-wam-latent]

The predictor produces hidden states for two related purposes.

One set of states is mapped back into JEPA representation space and trained to match the joint current future target.

Another set becomes the conditioning memory for the action expert.

Schematically:

```text
current cameras
      ↓
frozen V-JEPA
      ↓
dense current tokens
      ↓
shared predictor  ←  language instruction
      ↓
┌───────────────┬────────────────┐
↓               ↓
transition      action conditioning
features        features
↓               ↓
JEPA target     action DiT
loss            ↓
                action chunk
```

The important architectural choice is the shared predictor. World transition supervision updates the same backbone from which the action conditioning representation is extracted. The world objective is therefore not an isolated auxiliary module that the policy can easily ignore. [^jepa-wam-latent]

### Step four: train action and world prediction together

A simplified objective is

\[
\mathcal{L}
=
\mathcal{L}_{\mathrm{action}}
+
\lambda\mathcal{L}_{\mathrm{world}}.
\]

The world term aligns predicted patch features with the frozen joint current future target. The action term trains a flow matching action expert to generate a continuous action chunk. [^jepa-wam-latent]

The key point is not the exact coefficient \(\lambda\). It is the information path.

The model is forced to build a representation that is useful both for explaining how the scene changes and for producing actions.

## 7. World modeling can matter even when future prediction disappears at deployment

The most surprising consequence is that a WAM does not necessarily need to generate a future observation every time the robot acts.

JEPA-WAM uses its target branch only during training. At deployment, the future target and training only prediction machinery can be removed, while the current observation still passes through the learned action pathway. [^jepa-wam-latent]

Fast-WAM reaches a related conclusion from the video generation side. It separates two factors that are often bundled together: video prediction during training and explicit future imagination during inference. Its experiments find that keeping video co-training while skipping future video generation at test time remains competitive with imagine then execute variants, while removing video co-training causes a much larger drop in its controlled comparisons. [^fast-wam]

These results suggest a broader interpretation of world modeling:

**Predicting the future may be valuable because it teaches a better representation, even when the deployed policy does not explicitly render the future before every action.**

That is a major conceptual step away from the simple picture of a WAM as a robot that must first make a movie of the future and then act on that movie.

## 8. LeWAM pushes the representation argument even further

The September 2026 paper *Latent evolving World Action Model* asks the representation question directly. It compares visual encoders for action generation and reports that predictive JEPA embeddings support action generation better than compressed VAE latents in its tested setup, with I-JEPA performing best among the encoders in that comparison. [^lewam]

Based on that result, the paper introduces LeWAM. Instead of relying on a large pretrained video diffusion backbone, LeWAM conditions action generation on JEPA embeddings and predicts future embeddings in the same latent space. [^lewam]

This is a stronger departure from the inherited video generator recipe:

```text
observation
    ↓
JEPA representation
    ↓
latent world evolution
    ↓
action generation
```

The paper reports 0.4 billion trainable parameters and an average success rate of 92.28 percent on RoboTwin 2.0, alongside real robot experiments. These are benchmark specific results rather than proof that JEPA representations dominate VAE latents in every WAM. [^lewam]

Still, the result makes an important research question concrete.

If the main value of a pretrained video model is the representation it teaches, do we really need a generative backbone whose original purpose was reconstructing or synthesizing video?

LeWAM argues that, at least in its evaluated regime, the answer can be no.

## 9. Replacing VAE with JEPA is really a redefinition of state

It is tempting to summarize this research direction as

```text
VAE out
JEPA in
```

That is too shallow.

The real change is

\[
\text{What should the model call the state of the world?}
\]

A VAE style world state is shaped by reconstructability.

A JEPA style world state is shaped by predictability in representation space.

A robot state may need even more structure than either objective provides by itself. A strong embodied representation may need to combine several kinds of information:

\[
z_t
=
\left[
 z_t^{\mathrm{semantic}},
 z_t^{\mathrm{geometry}},
 z_t^{\mathrm{motion}},
 z_t^{\mathrm{proprioception}}
\right].
\]

The semantic component helps the robot understand objects and tasks.

The geometric component preserves pose and spatial relationships.

The motion component captures how things are changing.

Proprioception tells the model where the robot itself is.

For dexterous manipulation, one might also need tactile or contact related state.

This is why the original criticism about rotation and affine changes points toward a real issue but needs a more careful conclusion. The goal is not universal invariance. A good representation should ignore nuisance changes while preserving structured physical changes.

Likewise, a predictive encoder does not remove the need to model \(\Delta t\), action conditioning, geometry, or contact.

The encoder is one part of the world model design, not the entire solution.

## 10. Two different papers currently share the name JEPA-WAM

There is one naming trap worth recording because it can create major confusion when reading the 2026 literature.

The paper discussed above is *JEPA-WAM: Learning Vision-Language-Action Policies with Joint-Embedding World Modeling*. It builds a latent WAM in pretrained V-JEPA space and uses joint current future transition supervision to shape the action backbone. [^jepa-wam-latent]

A different 2026 paper is also called JEPA-WAM. Its title is *JEPA-WAM: Connecting Generated Visual Instructions to World Action Models through JEPA Latent Representations*. Its goal is instruction following. It generates task completion images from language, encodes those visual references with frozen V-JEPA, compresses them into goal tokens, and conditions the video and action experts on those tokens. [^jepa-wam-instructions]

The second paper therefore uses JEPA representations as visual goal instructions. It is not the same architectural claim as rebuilding the WAM world state and transition model in JEPA space.

When reading or discussing JEPA-WAM, the title matters.

## 11. A better way to state the cold water on WAMs

We can now return to the original criticism.

Saying

> VAE is fragile, therefore WAMs will fail

mixes together several different ideas.

A more defensible version is:

> Many video generation based WAMs inherit a reconstruction oriented VAE latent space. That space may preserve visual details that are useful for generation but poorly aligned with control, especially under appearance shifts. The next generation of WAMs may therefore benefit from predictive or semantic latent spaces, provided they still preserve geometry, motion, timing, and contact information needed for action.

This version matches the direction of several recent papers. Robust-WAM adds semantic foresight without throwing away the pretrained VAE path. JEPA-WAM moves transition supervision into a pretrained V-JEPA space. LeWAM goes further and removes the video diffusion backbone entirely. Fast-WAM separately shows that the representation learned through world modeling can matter even when explicit future generation is skipped at deployment. [^robust-wam] [^jepa-wam-latent] [^lewam] [^fast-wam]

This suggests a useful way to think about the evolution of WAMs.

The first generation often asks:

\[
\text{Can a video generator also teach a robot to act?}
\]

The emerging representation centered line asks:

\[
\text{What latent state makes physical change easiest to predict and control?}
\]

That second question is broader than VAE versus JEPA.

It asks what the robot should remember about the world, what it should ignore, and how the retained information should transform when the world moves.

The answer may eventually combine semantic prediction, explicit geometry, motion, proprioception, and contact rather than relying on any single encoder objective.

The most important shift is therefore not from one acronym to another.

It is from treating the video generator's latent as the world by default to designing the world representation around the needs of control.

## References and version notes

[^vae]: *Auto-Encoding Variational Bayes*. [arXiv:1312.6114](https://arxiv.org/abs/1312.6114). First submitted December 2013. Introduces the reparameterized variational learning framework behind the VAE.

[^ldm]: *High-Resolution Image Synthesis with Latent Diffusion Models*. [arXiv:2112.10752](https://arxiv.org/abs/2112.10752). First submitted December 2021 and published at CVPR 2022. Supports the use of pretrained autoencoder latents to reduce the cost of generative modeling.

[^robust-wam]: *Robust-WAM: Bridging Generative Pretraining and Semantic Foresight in World-Action Models*. [arXiv:2608.05903](https://arxiv.org/abs/2608.05903). Submitted August 2026. Supports the distinction between VAE reconstruction latents and semantic foresight for action robustness under visual shifts.

[^vjepa2]: *V-JEPA 2: Self-Supervised Video Models Enable Understanding, Prediction and Planning*. [arXiv:2506.09985](https://arxiv.org/abs/2506.09985). Submitted June 2025. Reports pretraining on over one million hours of video and images and post training an action conditioned latent world model with less than 62 hours of robot video for planning.

[^jepa-wam-latent]: *JEPA-WAM: Learning Vision-Language-Action Policies with Joint-Embedding World Modeling*. [arXiv:2608.09381](https://arxiv.org/abs/2608.09381). Submitted August 2026. Introduces a latent WAM in pretrained V-JEPA space with a spatially structured joint current future target, a shared predictor, and continuous action generation.

[^fast-wam]: *Fast-WAM: Do World Action Models Need Test-time Future Imagination?* [arXiv:2603.16666](https://arxiv.org/abs/2603.16666). Submitted March 2026. Separates training time video co-training from test time future generation and reports that explicit future imagination can be skipped in its proposed setup while retaining competitive control performance.

[^lewam]: *Latent evolving World Action Model*. [arXiv:2609.27455](https://arxiv.org/abs/2609.27455). Submitted September 2026. Introduces LeWAM, compares predictive JEPA embeddings with compressed VAE latents for action generation, and reports a 0.4 billion parameter model with 92.28 percent average success on RoboTwin 2.0.

[^jepa-wam-instructions]: *JEPA-WAM: Connecting Generated Visual Instructions to World Action Models through JEPA Latent Representations*. [arXiv:2609.20277](https://arxiv.org/abs/2609.20277). Submitted August 2026 and announced in September 2026. Uses generated visual goal references encoded by frozen V-JEPA to improve instruction following in a different WAM design.
