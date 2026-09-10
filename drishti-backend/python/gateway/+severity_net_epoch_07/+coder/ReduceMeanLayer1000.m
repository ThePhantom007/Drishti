classdef ReduceMeanLayer1000 < nnet.layer.Layer & nnet.layer.Formattable
    % A custom layer auto-generated while importing an ONNX network.
    %#codegen

    %#ok<*PROPLC>
    %#ok<*NBRAK>
    %#ok<*INUSL>
    %#ok<*VARARG>
    properties (Learnable)
    end

    properties (State)
    end

    properties
        Vars
        NumDims
    end

    methods(Static, Hidden)
        % Specify the properties of the class that will not be modified
        % after the first assignment.
        function p = matlabCodegenNontunableProperties(~)
            p = {
                % Constants, i.e., Vars, NumDims and all learnables and states
                'Vars'
                'NumDims'
                };
        end
    end


    methods(Static, Hidden)
        % Instantiate a codegenable layer instance from a MATLAB layer instance
        function this_cg = matlabCodegenToRedirected(mlInstance)
            this_cg = severity_net_epoch_07.coder.ReduceMeanLayer1000(mlInstance);
        end
        function this_ml = matlabCodegenFromRedirected(cgInstance)
            this_ml = severity_net_epoch_07.ReduceMeanLayer1000(cgInstance.Name);
            if isstruct(cgInstance.Vars)
                names = fieldnames(cgInstance.Vars);
                for i=1:numel(names)
                    fieldname = names{i};
                    this_ml.Vars.(fieldname) = dlarray(cgInstance.Vars.(fieldname));
                end
            else
                this_ml.Vars = [];
            end
            this_ml.NumDims = cgInstance.NumDims;
        end
    end

    methods
        function this = ReduceMeanLayer1000(mlInstance)
            this.Name = mlInstance.Name;
            this.OutputNames = {'x_blocks_blocks_0__5'};
            if isstruct(mlInstance.Vars)
                names = fieldnames(mlInstance.Vars);
                for i=1:numel(names)
                    fieldname = names{i};
                    this.Vars.(fieldname) = severity_net_epoch_07.coder.ops.extractIfDlarray(mlInstance.Vars.(fieldname));
                end
            else
                this.Vars = [];
            end

            this.NumDims = mlInstance.NumDims;
        end

        function [x_blocks_blocks_0__5] = predict(this, x_blocks_blocks_0_bl__)
            if isdlarray(x_blocks_blocks_0_bl__)
                x_blocks_blocks_0_bl_ = stripdims(x_blocks_blocks_0_bl__);
            else
                x_blocks_blocks_0_bl_ = x_blocks_blocks_0_bl__;
            end
            x_blocks_blocks_0_blNumDims = 4;
            x_blocks_blocks_0_bl = severity_net_epoch_07.coder.ops.permuteInputVar(x_blocks_blocks_0_bl_, [4 3 1 2], 4);

            [x_blocks_blocks_0__5__, x_blocks_blocks_0__5NumDims__] = ReduceMeanGraph1000(this, x_blocks_blocks_0_bl, x_blocks_blocks_0_blNumDims, false);
            x_blocks_blocks_0__5_ = severity_net_epoch_07.coder.ops.permuteOutputVar(x_blocks_blocks_0__5__, [3 4 2 1], 4);

            x_blocks_blocks_0__5 = dlarray(single(x_blocks_blocks_0__5_), 'SSCB');
        end

        function [x_blocks_blocks_0__5, x_blocks_blocks_0__5NumDims1002] = ReduceMeanGraph1000(this, x_blocks_blocks_0_bl, x_blocks_blocks_0_blNumDims, Training)

            % Execute the operators:
            % ReduceMean:
            dims1000 = severity_net_epoch_07.coder.ops.prepareReduceArgs(this.Vars.ReduceMeanAxes1001, coder.const(x_blocks_blocks_0_blNumDims));
            xReduced1001 = mean(x_blocks_blocks_0_bl, dims1000);
            x_blocks_blocks_0__5 = xReduced1001;
            x_blocks_blocks_0__5NumDims = coder.const(x_blocks_blocks_0_blNumDims);

            % Set graph output arguments
            x_blocks_blocks_0__5NumDims1002 = coder.const(x_blocks_blocks_0__5NumDims);

        end

    end

end