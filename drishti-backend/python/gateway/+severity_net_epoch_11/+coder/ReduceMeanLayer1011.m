classdef ReduceMeanLayer1011 < nnet.layer.Layer & nnet.layer.Formattable
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
            this_cg = severity_net_epoch_11.coder.ReduceMeanLayer1011(mlInstance);
        end
        function this_ml = matlabCodegenFromRedirected(cgInstance)
            this_ml = severity_net_epoch_11.ReduceMeanLayer1011(cgInstance.Name);
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
        function this = ReduceMeanLayer1011(mlInstance)
            this.Name = mlInstance.Name;
            this.OutputNames = {'x_blocks_blocks_3_53'};
            if isstruct(mlInstance.Vars)
                names = fieldnames(mlInstance.Vars);
                for i=1:numel(names)
                    fieldname = names{i};
                    this.Vars.(fieldname) = severity_net_epoch_11.coder.ops.extractIfDlarray(mlInstance.Vars.(fieldname));
                end
            else
                this.Vars = [];
            end

            this.NumDims = mlInstance.NumDims;
        end

        function [x_blocks_blocks_3_53] = predict(this, x_blocks_blocks_3_47__)
            if isdlarray(x_blocks_blocks_3_47__)
                x_blocks_blocks_3_47_ = stripdims(x_blocks_blocks_3_47__);
            else
                x_blocks_blocks_3_47_ = x_blocks_blocks_3_47__;
            end
            x_blocks_blocks_3_47NumDims = 4;
            x_blocks_blocks_3_47 = severity_net_epoch_11.coder.ops.permuteInputVar(x_blocks_blocks_3_47_, [4 3 1 2], 4);

            [x_blocks_blocks_3_53__, x_blocks_blocks_3_53NumDims__] = ReduceMeanGraph1033(this, x_blocks_blocks_3_47, x_blocks_blocks_3_47NumDims, false);
            x_blocks_blocks_3_53_ = severity_net_epoch_11.coder.ops.permuteOutputVar(x_blocks_blocks_3_53__, [3 4 2 1], 4);

            x_blocks_blocks_3_53 = dlarray(single(x_blocks_blocks_3_53_), 'SSCB');
        end

        function [x_blocks_blocks_3_53, x_blocks_blocks_3_53NumDims1035] = ReduceMeanGraph1033(this, x_blocks_blocks_3_47, x_blocks_blocks_3_47NumDims, Training)

            % Execute the operators:
            % ReduceMean:
            dims1022 = severity_net_epoch_11.coder.ops.prepareReduceArgs(this.Vars.ReduceMeanAxes1034, coder.const(x_blocks_blocks_3_47NumDims));
            xReduced1023 = mean(x_blocks_blocks_3_47, dims1022);
            x_blocks_blocks_3_53 = xReduced1023;
            x_blocks_blocks_3_53NumDims = coder.const(x_blocks_blocks_3_47NumDims);

            % Set graph output arguments
            x_blocks_blocks_3_53NumDims1035 = coder.const(x_blocks_blocks_3_53NumDims);

        end

    end

end